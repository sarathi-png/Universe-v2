import { Router } from "express";
import { promises as dnsPromises } from "dns";
import {
  scanMovie,
  scanMedia,
  getBestFileForLanguage,
  getCachedLanguages,
  getBatchLanguages,
  type SubtitleFile,
} from "../services/languageScanner.js";
import { streamRemuxedFile } from "../services/streamRemux.js";
import { scrapeAll } from "../services/openScraperEngine.js";
import { searchMovieTorrents, searchTVTorrents } from "../services/torrentManager.js";
import { searchTamilmv } from "../services/tamilmvScraper.js";

export const languageRouter = Router();

const scanLocks = new Map<string, Promise<unknown>>();

function withScanLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = scanLocks.get(key);
  if (existing) return existing as Promise<T>;
  const run = fn().then(
    (value) => {
      if (scanLocks.get(key) === run) scanLocks.delete(key);
      return value;
    },
    (err) => {
      if (scanLocks.get(key) === run) scanLocks.delete(key);
      throw err;
    }
  );
  scanLocks.set(key, run);
  return run;
}

const PRIVATE_IP_RE = /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;

function isPrivateIp(address: string): boolean {
  const a = address.toLowerCase();
  if (a.includes(":")) {
    if (a.startsWith("::ffff:")) return PRIVATE_IP_RE.test(a.slice(7));
    return a === "::" || a === "::1" || /^fc|^fd/.test(a) || /^fe[89ab]/.test(a);
  }
  return PRIVATE_IP_RE.test(a);
}

async function isSafeRequestUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" || host.endsWith(".localhost") ||
    host.endsWith(".local") || host === "0.0.0.0"
  ) {
    return false;
  }

  try {
    const addresses = await dnsPromises.lookup(host, { all: true });
    return addresses.every(({ address }) => !isPrivateIp(address));
  } catch (err) {
    console.error(`[language] DNS lookup failed for ${host}:`, err);
    return false;
  }
}

// Tier 1: Direct file server
// Tier 2: Torrent streams
// Tier 3: Web scrapers / embed providers

languageRouter.get("/media/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      res.status(400).json({ error: "Invalid TMDB ID" });
      return;
    }
    const type = (req.query.type as string) || "movie";
    if (type !== "movie" && type !== "tv") {
      res.status(400).json({ error: "Invalid type" });
      return;
    }
    const season = req.query.season !== undefined ? Number(req.query.season) : undefined;
    const episode = req.query.episode !== undefined ? Number(req.query.episode) : undefined;
    if (season !== undefined && (!Number.isInteger(season) || season <= 0)) {
      res.status(400).json({ error: "Invalid season" });
      return;
    }
    if (episode !== undefined && (!Number.isInteger(episode) || episode <= 0)) {
      res.status(400).json({ error: "Invalid episode" });
      return;
    }
    const lang = req.query.lang as string | undefined;

    // Tier 1: Direct file server sources
    const directResult = await withScanLock(`media:${numId}:${type}:${season ?? "*"}:${episode ?? "*"}`, () =>
      scanMedia(id, type, season, episode)
    );
    const sources: any[] = [];

    if (directResult && directResult.sources.length > 0) {
      for (const [idx, f] of directResult.sources.entries()) {
        sources.push({
          url: f.url,
          directUrl: f.directUrl,
          name: f.name,
          provider: idx === 0 ? "Primary File Server" : `Mirror ${idx + 1}`,
          quality: parseQuality(f.name),
          languages: directResult.languages,
          isEmbed: false,
          playUrl: /\.(mkv|avi|webm)$/i.test(f.name)
            ? `/api/language/transcode?url=${encodeURIComponent(f.directUrl)}&lang=${lang || "en"}`
            : null,
        });
      }
    }

    // Tier 2: Torrent stream sources
    const torrentSources = type === "movie"
      ? await searchMovieTorrents(numId)
      : await searchTVTorrents(numId, season || 1, episode || 1);

    for (const t of torrentSources) {
      sources.push({
        url: `/api/torrent/play?magnet=${encodeURIComponent(t.magnet)}`,
        directUrl: null,
        name: t.name.length > 60 ? t.name.substring(0, 57) + "..." : t.name,
        provider: `Torrent (${t.seeds}S/${t.peers}P)`,
        quality: t.quality,
        languages: ["en"],
        isEmbed: false,
        playUrl: null,
        providerId: `torrent_${t.quality.toLowerCase()}`,
      });
    }

    // Tier 2.5: 1TamilMV magnet sources (live search + scrape)
    try {
      const tamilmvResult = await searchTamilmv(numId, type);
      if (tamilmvResult && tamilmvResult.torrents.length > 0) {
        for (const t of tamilmvResult.torrents) {
          const name = tamilmvResult.title.length > 55
            ? tamilmvResult.title.substring(0, 52) + "..." : tamilmvResult.title;
          sources.push({
            url: `/api/torrent/play?magnet=${encodeURIComponent(t.magnet)}`,
            directUrl: null,
            name: `${name} [${t.quality}]`,
            provider: `1TamilMV (${t.quality})`,
            quality: t.quality,
            languages: t.languages.length > 0 ? t.languages : ["en"],
            isEmbed: false,
            playUrl: null,
            providerId: `1tamilmv_${t.quality.toLowerCase()}`,
          });
        }
      }
    } catch {
      // 1TamilMV search is non-critical; silently skip on failure
    }

    // Tier 3: Web scraper / embed fallback sources
    const scraperResult = await scrapeAll(numId, type, season, episode);
    for (const s of scraperResult.sources) {
      sources.push(s);
    }

    // Sort: prefer language match first, then highest quality
    if (lang) {
      sources.sort((a, b) => {
        if (a.isEmbed && !b.isEmbed) return 1;
        if (!a.isEmbed && b.isEmbed) return -1;
        const aMatch = a.languages?.includes(lang) ? 0 : 1;
        const bMatch = b.languages?.includes(lang) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return qualityScore(b.quality) - qualityScore(a.quality);
      });
    } else {
      sources.sort((a, b) => {
        if (a.isEmbed && !b.isEmbed) return 1;
        if (!a.isEmbed && b.isEmbed) return -1;
        return qualityScore(b.quality) - qualityScore(a.quality);
      });
    }

    const allSubtitles: SubtitleFile[] = directResult?.subtitles || [];

    res.json({
      tmdbId: numId,
      type,
      season,
      episode,

      sources,
      subtitles: allSubtitles,
    });
  } catch (err) {
    res.status(500).json({ error: "Media lookup failed", message: String(err) });
  }
});

languageRouter.get("/stream/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      res.status(400).json({ error: "Invalid TMDB ID" });
      return;
    }
    const lang = (req.query.lang as string) || "en";
    const type = (req.query.type as string) || "movie";
    if (type !== "movie" && type !== "tv") {
      res.status(400).json({ error: "Invalid type" });
      return;
    }

    let cached = getCachedLanguages(id);
    if (!cached) {
      cached = await withScanLock(`lang:${numId}:${type}`, () => scanMovie(id, type));
    }

    const file = getBestFileForLanguage(id, lang);
    if (!file) {
      res.status(404).json({ error: "No stream files found for this movie", tmdbId: id });
      return;
    }

    const containsTarget = cached?.languages?.includes(lang) ?? false;

    res.json({
      tmdbId: id,
      url: file.url,
      name: file.name,
      languages: cached?.languages ?? [],
      targetLanguage: containsTarget ? lang : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Stream lookup failed", message: String(err) });
  }
});

languageRouter.get("/play/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      res.status(400).json({ error: "Invalid TMDB ID" });
      return;
    }
    const lang = (req.query.lang as string) || "en";
    const type = (req.query.type as string) || "movie";
    if (type !== "movie" && type !== "tv") {
      res.status(400).json({ error: "Invalid type" });
      return;
    }

    let cached = getCachedLanguages(id);
    if (!cached) {
      cached = await withScanLock(`lang:${numId}:${type}`, () => scanMovie(id, type));
    }

    const file = getBestFileForLanguage(id, lang);
    if (!file) {
      res.status(404).json({ error: "No stream files found", tmdbId: id });
      return;
    }

    res.setHeader("Content-Type", "video/mp4");
    await streamRemuxedFile(file.directUrl, lang, res, req);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Playback failed", message: String(err) });
    }
  }
});

languageRouter.get("/scan/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      res.status(400).json({ error: "Invalid TMDB ID" });
      return;
    }
    const type = (req.query.type as string) || "movie";
    if (type !== "movie" && type !== "tv") {
      res.status(400).json({ error: "Invalid type" });
      return;
    }
    const title = req.query.title as string | undefined;
    const year = req.query.year as string | undefined;
    const result = await withScanLock(`scan:${numId}:${type}:${title ?? ""}:${year ?? ""}`, () =>
      scanMovie(id, type, title, year)
    );
    res.json({ tmdbId: id, ...result });
  } catch (err) {
    res.status(500).json({ error: "Scan failed", message: String(err) });
  }
});

languageRouter.get("/transcode", async (req, res) => {
  try {
    const url = req.query.url as string | undefined;
    const lang = (req.query.lang as string) || "en";
    if (!url) {
      res.status(400).json({ error: "Missing url parameter" });
      return;
    }
    if (!(await isSafeRequestUrl(url))) {
      res.status(400).json({ error: "Invalid or unsafe url parameter" });
      return;
    }
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    await streamRemuxedFile(url, lang, res, req);
  } catch (err) {
    console.error("[language] transcode failed:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Transcode failed" });
    }
  }
});

languageRouter.get("/:id", (req, res) => {
  const { id } = req.params;
  const cached = getCachedLanguages(id);
  if (cached) {
    res.json({ tmdbId: id, ...cached });
  } else {
    res.status(404).json({ error: "Not scanned yet", tmdbId: id });
  }
});

languageRouter.post("/batch", (req, res) => {
  const { ids } = req.body as { ids?: unknown };
  if (!Array.isArray(ids)) {
    res.status(400).json({ error: "ids must be an array" });
    return;
  }
  if (ids.length > 50) {
    res.status(400).json({ error: "ids array too large (max 50)" });
    return;
  }
  for (const raw of ids) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
      res.status(400).json({ error: "ids must contain only positive integers" });
      return;
    }
  }
  const result = getBatchLanguages(ids as (string | number)[]);
  res.json(result);
});

function parseQuality(name: string): string {
  const m = name.match(/\b(2160p|1080p|720p|480p|360p|4[Kk])\b/);
  if (!m) return "HD";
  if (m[1].toLowerCase() === "4k") return "4K";
  return m[1];
}

function qualityScore(q: string): number {
  const map: Record<string, number> = { "4K": 5, "2160p": 5, "1080p": 4, "720p": 3, "480p": 2, "360p": 1, HD: 3 };
  return map[q] || 0;
}
