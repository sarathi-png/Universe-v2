import type { Request, Response } from "express";
import axios from "axios";
import { searchAllTorrents, searchAllV2, type ScrapedTorrent } from "./scrapers.js";

const http = axios.create({ timeout: 8000, validateStatus: () => true });

function getTmdbKey(): string {
  return process.env.TMDB_API_KEY || "";
}
const TPB_API = "https://apibay.org";
const EZTV_API = "https://eztvx.to/api";

const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://tracker.dler.org:6969/announce",
  "https://tracker.moeblog.cn:443/announce",
  "https://tracker.zhuqiy.com:443/announce",
  "udp://open.dstud.io:6969/announce",
];

const VIDEO_EXTS = /\.(mp4|mkv|avi|webm|m4v|mov)$/i;

export interface TorrentSource {
  magnet: string;
  name: string;
  quality: string;
  size: string;
  seeds: number;
  peers: number;
  languages?: string[];
}

const imdbCache = new Map<string, string>();

// ── TorrentEngine v2 (LRU, memory-managed) ──────────────────────

class TorrentEngine {
  private client: any = null;
  private initAttempted = false;
  private active = new Map<string, any>();
  private accessLog = new Map<string, number>();
  private streamCount = new Map<string, number>();
  private maxActive = 3;
  private idleTimeout = 15 * 60 * 1000;
  private memoryWarning = 400 * 1024 * 1024;
  private evictInterval: ReturnType<typeof setInterval> | null = null;
  private warned = false;

  constructor() {
    this.maxActive = parseInt(process.env.MAX_ACTIVE_TORRENTS || "3");
    this.idleTimeout = parseInt(process.env.IDLE_TIMEOUT_MS || String(15 * 60 * 1000));
    this.memoryWarning = parseInt(process.env.MEMORY_WARNING_BYTES || String(400 * 1024 * 1024));
    this.evictInterval = setInterval(() => this.evict(), 60_000);
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;
    if (this.initAttempted) return null;
    this.initAttempted = true;
    try {
      const mod = await import("webtorrent");
      const WebTorrent = mod.default || mod;
      this.client = new WebTorrent({ maxConns: 55 });
      return this.client;
    } catch {
      return null;
    }
  }

  async addMagnet(magnet: string): Promise<any> {
    const c = await this.getClient();
    if (!c) throw new Error("Torrent engine unavailable");

    const existing = await c.get(magnet);
    if (existing) {
      this.accessLog.set(existing.infoHash, Date.now());
      return existing;
    }

    if (this.active.size >= this.maxActive) this.evictOne();

    return new Promise((resolve, reject) => {
      const torrent = c.add(magnet, { announce: TRACKERS, strategy: "sequential" });

      const timeout = setTimeout(() => {
        if (!torrent.ready) {
          try { torrent.destroy(); } catch {}
          reject(new Error("Metadata timeout"));
        }
      }, 30_000);

      torrent.on("metadata", () => {
        clearTimeout(timeout);
        this.active.set(torrent.infoHash, torrent);
        this.accessLog.set(torrent.infoHash, Date.now());
        this.streamCount.set(torrent.infoHash, 0);
        this.checkMemory();
        resolve(torrent);
      });
      torrent.on("error", (err: Error) => { clearTimeout(timeout); reject(err); });
      torrent.on("warning", () => {});
    });
  }

  getLargestVideoFile(torrent: any): any {
    const files = torrent.files?.filter((f: any) => VIDEO_EXTS.test(f.name)) || [];
    if (files.length === 0) return null;
    files.sort((a: any, b: any) => b.length - a.length);
    return files[0];
  }

  createReadStream(file: any, start: number, end: number) {
    return file.createReadStream({ start, end });
  }

  private checkMemory() {
    const mem = process.memoryUsage();
    if (mem.rss > this.memoryWarning && !this.warned) {
      console.warn(`[engine] Memory: ${(mem.rss / 1024 / 1024).toFixed(0)}MB RSS`);
      this.warned = true;
    }
    if (mem.rss < this.memoryWarning * 0.7) this.warned = false;
  }

  evict() {
    const now = Date.now();
    for (const [hash] of this.active) {
      const lastAccess = this.accessLog.get(hash) || 0;
      if (now - lastAccess > this.idleTimeout && (this.streamCount.get(hash) || 0) === 0) {
        this.remove(hash);
      }
    }
  }

  private evictOne() {
    let oldest = Infinity;
    let oldestHash: string | null = null;
    for (const [hash, lastAccess] of this.accessLog) {
      if ((this.streamCount.get(hash) || 0) > 0) continue;
      if (lastAccess < oldest) { oldest = lastAccess; oldestHash = hash; }
    }
    if (oldestHash) this.remove(oldestHash);
  }

  private remove(hash: string) {
    const torrent = this.active.get(hash);
    if (torrent) try { torrent.destroy(); } catch {}
    this.active.delete(hash);
    this.accessLog.delete(hash);
    this.streamCount.delete(hash);
  }

  getStatus() {
    return {
      activeCount: this.active.size,
      maxActive: this.maxActive,
      torrents: Array.from(this.active.entries()).map(([hash, t]) => ({
        infoHash: hash,
        name: t.name || "Fetching...",
        progress: Math.round(t.progress * 100),
        downloadSpeed: t.downloadSpeed,
        peers: t.numPeers,
        files: t.files?.length || 0,
        received: t.received,
      })),
      memory: { rss: Math.round(process.memoryUsage().rss / 1024 / 1024), heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) },
    };
  }

  destroy() {
    if (this.evictInterval) clearInterval(this.evictInterval);
    for (const hash of this.active.keys()) this.remove(hash);
    if (this.client) this.client.destroy();
  }
}

export const engine = new TorrentEngine();

// ── Search functions ─────────────────────────────────────────────

async function getMovieTitle(tmdbId: number): Promise<{ title: string; year?: string } | null> {
  try {
    const res = await http.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${getTmdbKey()}`);
    const data = res.data as { title?: string; release_date?: string };
    if (!data.title) return null;
    const year = data.release_date ? data.release_date.split("-")[0] : undefined;
    return { title: data.title, year };
  } catch { return null; }
}

async function getTVTitle(tmdbId: number): Promise<{ title: string; year?: string } | null> {
  try {
    const res = await http.get(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${getTmdbKey()}`);
    const data = res.data as { name?: string; first_air_date?: string };
    if (!data.name) return null;
    const year = data.first_air_date ? data.first_air_date.split("-")[0] : undefined;
    return { title: data.name, year };
  } catch { return null; }
}

export function extractInfoHash(magnet: string): string | null {
  const decoded = decodeURIComponent(magnet);
  const m = decoded.match(/xt=urn:btih:([a-fA-F0-9]+)/i);
  return m ? m[1].toLowerCase() : null;
}

async function getImdbId(tmdbId: number, type: "movie" | "tv"): Promise<string | null> {
  const key = `${type}_${tmdbId}`;
  const cached = imdbCache.get(key);
  if (cached) return cached;
  try {
    const endpoint = type === "movie"
      ? `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids`
      : `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids`;
    const res = await http.get(`${endpoint}?api_key=${getTmdbKey()}`);
    const data = res.data as { imdb_id?: string };
    if (data.imdb_id) { imdbCache.set(key, data.imdb_id); return data.imdb_id; }
    return null;
  } catch { return null; }
}

function buildMagnet(infoHash: string, name: string): string {
  const parts = [`xt=urn:btih:${infoHash}`, `dn=${encodeURIComponent(name)}`];
  for (const tr of TRACKERS) parts.push(`tr=${encodeURIComponent(tr)}`);
  return `magnet:?${parts.join("&")}`;
}

function parseQualityFromName(name: string): string {
  const m = name.match(/\b(2160p|1080p|720p|480p|360p|4[Kk])\b/);
  if (!m) return "HD";
  return m[1].toLowerCase() === "4k" ? "4K" : m[1];
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return "Unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

export async function searchMovieTorrents(tmdbId: number): Promise<TorrentSource[]> {
  const [imdbId, meta] = await Promise.all([getImdbId(tmdbId, "movie"), getMovieTitle(tmdbId)]);
  const results: TorrentSource[] = [];

  if (imdbId) {
    try {
      const res = await http.get(`${TPB_API}/q.php?q=${imdbId}&cat=201`);
      const data = res.data as any[];
      if (Array.isArray(data)) {
        for (const t of data) {
          if (t.info_hash && t.name && Number(t.seeders) > 0) {
            results.push({
              magnet: buildMagnet(t.info_hash, t.name),
              name: t.name,
              quality: parseQualityFromName(t.name),
              size: formatSize(Number(t.size) || 0),
              seeds: Number(t.seeders) || 0,
              peers: Number(t.leechers) || 0,
            });
          }
        }
      }
    } catch {}
  }

  if (meta) {
    const scraped = await searchAllTorrents(meta.title, meta.year);
    for (const t of scraped) results.push(t);
  }

  const seen = new Set<string>();
  return results
    .filter((t) => {
      const hash = extractInfoHash(t.magnet);
      if (!hash || seen.has(hash)) return false;
      seen.add(hash);
      return true;
    })
    .sort((a, b) => b.seeds - a.seeds);
}

export async function searchTVTorrents(tmdbId: number, season: number, episode: number): Promise<TorrentSource[]> {
  const [imdbId, meta] = await Promise.all([getImdbId(tmdbId, "tv"), getTVTitle(tmdbId)]);
  const results: TorrentSource[] = [];

  if (imdbId) {
    try {
      const res = await http.get(`${EZTV_API}/get-torrents?imdb_id=${imdbId}&limit=50`);
      const data = res.data as { torrents?: any[] };
      if (data.torrents) {
        for (const t of data.torrents) {
          const s = Number(t.season);
          const e = Number(t.episode);
          if (s === season && e === episode && t.seeds > 0 && t.magnet_url) {
            results.push({
              magnet: t.magnet_url,
              name: t.filename || t.title || "",
              quality: parseQualityFromName(t.filename || t.title || ""),
              size: formatSize(Number(t.size_bytes) || 0),
              seeds: Number(t.seeds) || 0,
              peers: Number(t.peers) || 0,
            });
          }
        }
      }
    } catch {}
  }

  if (meta) {
    const query = `${meta.title} S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
    const scraped = await searchAllTorrents(query, meta.year);
    for (const t of scraped) results.push(t);
  }

  const seen = new Set<string>();
  return results
    .filter((t) => {
      const hash = extractInfoHash(t.magnet);
      if (!hash || seen.has(hash)) return false;
      seen.add(hash);
      return true;
    })
    .sort((a, b) => b.seeds - a.seeds);
}

// ── New: search by title directly (for v2 search route) ──────────

export async function searchByName(
  query: string,
  options?: { quality?: string; lang?: string; limit?: number }
): Promise<ScrapedTorrent[]> {
  return searchAllV2(query, {
    quality: options?.quality,
    lang: options?.lang,
    limit: options?.limit || 30,
  });
}

// ── Stream handler with v2 engine ────────────────────────────────

export async function handleTorrentStream(req: Request, res: Response): Promise<void> {
  const magnet = (req.query.magnet as string) || (req.query.m as string);
  if (!magnet) {
    res.status(400).json({ error: "Missing magnet parameter" });
    return;
  }

  try {
    const infoHash = extractInfoHash(magnet);
    if (!infoHash) {
      res.status(400).json({ error: "Invalid magnet URL" });
      return;
    }

    const torrent = await engine.addMagnet(magnet);
    const file = engine.getLargestVideoFile(torrent);
    if (!file) {
      res.status(404).json({ error: "No video files in torrent" });
      return;
    }

    const fileSize = file.length;
    const range = req.headers.range;
    let start = 0;
    let end = fileSize - 1;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0], 10);
      if (isNaN(start)) start = 0;
      end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (isNaN(end)) end = fileSize - 1;
    }

    const chunkSize = end - start + 1;
    const contentType = getContentType(file.name);

    const headers: Record<string, string | number> = {
      "Content-Type": contentType,
      "Content-Length": chunkSize,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    };
    if (range) {
      headers["Content-Range"] = `bytes ${start}-${end}/${fileSize}`;
    }
    res.writeHead(range ? 206 : 200, headers);

    const stream = engine.createReadStream(file, start, end);
    stream.pipe(res);
    stream.on("error", () => { if (!res.headersSent) res.end(); });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(502).json({ error: "Stream failed", message: err.message });
    }
  }
}

export function safeTorrentStream(req: Request, res: Response): void {
  handleTorrentStream(req, res).catch((err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: "Torrent stream error", message: String(err) });
    }
  });
}

export function cleanupTorrents(): void {
  engine.evict();
}

export function getActiveTorrentCount(): number {
  return engine.getStatus().activeCount;
}

export function getTorrentStatus() {
  return engine.getStatus();
}

function getContentType(filename: string): string {
  const ext = filename?.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp4: "video/mp4", mkv: "video/x-matroska", avi: "video/x-msvideo",
    webm: "video/webm", m4v: "video/mp4", mov: "video/quicktime",
  };
  return map[ext ?? ""] || "video/mp4";
}
