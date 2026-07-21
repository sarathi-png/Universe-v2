import axios from "axios";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

const TMDB_KEY = () => process.env.TMDB_API_KEY || "";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BASE = "https://www.1tamilmv.reisen";

const PAREN_YEAR = /\s*\(\d{4}\)\s*/g;

function cleanTitle(raw: string): string {
  return aggressivelyClean(raw);
}

export interface TamilmvTorrent {
  magnet: string;
  quality: string;
  size: string;
  format: string;
  audio: string;
  languages: string[];
}

export interface TamilmvResult {
  topicId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  torrents: TamilmvTorrent[];
}

// ── TetraX TMDB database (same as dubmvScraper) ─────────────────

interface TetraxDb { [key: string]: [string, "movie" | "tv", string | null] }

let tetraxDb: TetraxDb | null = null;

function loadTetraxDb(): TetraxDb {
  if (tetraxDb) return tetraxDb;
  const p = resolve(DATA_DIR, "tetrax-tmdb.json");
  if (!existsSync(p)) {
    tetraxDb = {};
    return tetraxDb;
  }
  tetraxDb = JSON.parse(readFileSync(p, "utf-8")) as TetraxDb;
  return tetraxDb!;
}

const AGGRESSIVE_NOISE = /\b(\d+[.]?\d*\s*(gb|mb|kb)|1080p|720p|2160p|480p|360p|4k|hdtv|hdrip|hdts|predvd|dvdscr|cam|tc|bluray|blu-ray|brrip|web-dl|webdl|webrip|hq|clean|audio|new|dub|multi|sub|esub|true|original|aac|dd5[.]1|ddplus|dd[+]|dts|mp3|flac|ac3|x264|x265|hevc|avc|h[.]264|h[.]265|amzn|nf|netflix|hotstar|prime|hulu|disney[+])\b/gi;

function aggressivelyClean(raw: string): string {
  return raw
    .replace(/www\.\S+\s*-\s*/gi, "")
    .replace(/\s*\[.*?\]\s*/g, " ")
    .replace(PAREN_YEAR, " ")
    .replace(AGGRESSIVE_NOISE, "")
    .replace(/\.\w{3,4}$/, "")
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchToTmdb(title: string, year: number | null): [number | null, "movie" | "tv", number] {
  const db = loadTetraxDb();
  const clean = aggressivelyClean(title)
    .toLowerCase();

  let bestScore = 0;
  let bestMatch: [number | null, "movie" | "tv"] = [null, "movie"];

  for (const [key, val] of Object.entries(db)) {
    const [dbTitleRaw, dbYearRaw] = key.split("|");
    const dbTitle = dbTitleRaw.toLowerCase().replace(/[^a-z0-9\s]/gi, "").trim();
    const dbYear = parseInt(dbYearRaw);

    if (year && dbYear !== year) continue;

    const tWords = new Set(clean.split(/\s+/));
    const dWords = dbTitle.split(/\s+/);
    const intersection = [...tWords].filter((w) => dWords.includes(w)).length;
    const union = new Set([...tWords, ...dWords]).size;
    const jaccard = union > 0 ? intersection / union : 0;

    if (jaccard > bestScore) {
      bestScore = jaccard;
      bestMatch = [parseInt(val[0]), val[1]];
    }
  }
  return [...bestMatch, bestScore] as [number | null, "movie" | "tv", number];
}

// ── Local cache (like dubmvScraper's tamil-dubbed.json) ─────────

const CACHE_PATH = resolve(DATA_DIR, "tamilmv-cache.json");

interface CacheEntry extends TamilmvResult {
  tmdbId: number;
  type: "movie" | "tv";
  cachedAt: string;
}

let tamilmvCache: Map<string, CacheEntry> | null = null;

function loadCache(): Map<string, CacheEntry> {
  if (tamilmvCache) return tamilmvCache;
  tamilmvCache = new Map();
  if (existsSync(CACHE_PATH)) {
    const raw = JSON.parse(readFileSync(CACHE_PATH, "utf-8")) as [string, CacheEntry][];
    for (const [k, v] of raw) tamilmvCache.set(k, v);
  }
  return tamilmvCache;
}

function saveCache(): void {
  if (!tamilmvCache) return;
  const raw = [...tamilmvCache.entries()];
  writeFileSync(CACHE_PATH, JSON.stringify(raw, null, 2), "utf-8");
}

function getCacheKey(tmdbId: number, type: "movie" | "tv"): string {
  return `${tmdbId}:${type}`;
}

function findInCache(tmdbId: number, type: "movie" | "tv"): TamilmvResult | null {
  const cache = loadCache();
  const key = getCacheKey(tmdbId, type);
  const entry = cache.get(key);
  if (!entry) return null;
  return entry as TamilmvResult;
}

function setInCache(entry: CacheEntry): void {
  const cache = loadCache();
  const key = getCacheKey(entry.tmdbId, entry.type);
  cache.set(key, entry);
  saveCache();
}

// ── Helper functions ─────────────────────────────────────────────

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function parseLanguages(text: string): string[] {
  const langMap: Record<string, string> = {
    tamil: "ta", telugu: "te", hindi: "hi",
    malayalam: "ml", kannada: "kn", english: "en",
    eng: "en", tam: "ta", tel: "te", hin: "hi",
    mal: "ml", kan: "kn", korean: "ko", japanese: "ja",
    spanish: "es", french: "fr", german: "de",
  };
  const found: string[] = [];
  for (const [key, code] of Object.entries(langMap)) {
    if (text.toLowerCase().includes(key)) {
      if (!found.includes(code)) found.push(code);
    }
  }
  return found;
}

function parseQuality(text: string): string {
  const m = text.match(/\b(2160p|1080p|720p|480p|360p|4[Kk])\b/);
  if (!m) return "HD";
  return m[1].toLowerCase() === "4k" ? "4K" : m[1];
}

function parseFormat(text: string): string {
  const m = text.match(/\b(x264|x265|HEVC|AVC|H\.264|H\.265)\b/i);
  return m ? m[1].toUpperCase() : "Unknown";
}

function parseAudio(text: string): string {
  const m = text.match(/\b(AAC|DD[++]?\s*(?:\d+\.\d)?|DTS|AC3|MP3|FLAC)\b/i);
  if (m) return m[1];
  const m2 = text.match(/(\w+\+?\s*\d+\.?\d*\s*Kbps)/i);
  return m2 ? m2[1].trim() : "Unknown";
}

function extractYear(text: string): number | null {
  const m = text.match(/\(?(19\d{2}|20\d{2})\)?/);
  return m ? parseInt(m[1]) : null;
}

async function getTmdbTitle(tmdbId: number, type: "movie" | "tv"): Promise<{ title: string; year: string | null } | null> {
  try {
    const endpoint = type === "movie" ? "movie" : "tv";
    const { data } = await axios.get(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}`, {
      params: { api_key: TMDB_KEY() },
      timeout: 8000,
    });
    const title = type === "movie" ? data.title : data.name;
    const date = type === "movie" ? data.release_date : data.first_air_date;
    const year = date ? date.split("-")[0] : null;
    return { title, year };
  } catch {
    return null;
  }
}

// ── Search 1TamilMV ──────────────────────────────────────────────

async function search1TamilMV(query: string): Promise<{ topicId: number; slug: string; title: string; clean: string; year: number | null }[]> {
  try {
    const searchUrl = `${BASE}/index.php?/search/&q=${encodeURIComponent(query)}&type=forums_topic`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": UA, Accept: "text/html", Referer: `${BASE}/` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const topicRegex = /\/forums\/topic\/(\d+)-([^"'<&]+)/g;
    const matches = [...html.matchAll(topicRegex)];
    if (matches.length === 0) return [];

    const seen = new Set<string>();
    const results: { topicId: number; slug: string; title: string; clean: string; year: number | null }[] = [];
    for (const m of matches) {
      const id = m[1];
      if (!seen.has(id)) {
        seen.add(id);
        const rawSlug = m[2].replace(/&amp;/g, "&").replace(/\/+$/, "");
        const decodedTitle = decodeURIComponent(rawSlug).replace(/-/g, " ").trim();
        const year = extractYear(decodedTitle);
        const clean = aggressivelyClean(decodedTitle);
        results.push({ topicId: parseInt(id), slug: rawSlug, title: decodedTitle, clean, year });
      }
    }

    return results.filter((c) => c.topicId !== 183 && c.slug.length > 5);
  } catch {
    return [];
  }
}

function pickBestCandidate(
  candidates: { topicId: number; slug: string; title: string; clean: string; year: number | null }[],
  query: string,
  targetTmdbId?: number
): { topicId: number; slug: string; title: string } | null {
  if (candidates.length === 0) return null;

  const qualityHints = /\b(1080p|720p|2160p|4k|bluray|blu-ray|web-dl|webdl|hdts|hdtv|predvd|dvdscr|cam|tc|x264|x265|hevc|brrip|webrip|hq)\b/i;
  const penaltyHints = /\b(story|trailer|review|explanation|making|behind|scenes|teaser|official\s*trailer|full\s*story)\b/i;
  const queryYear = extractYear(query);
  const cleanQuery = query.replace(/[^a-z0-9\s]/gi, "").toLowerCase();

  // If targetTmdbId is provided, use TetraX matching
  if (targetTmdbId) {
    for (const c of candidates) {
      const [matchedTmdbId, , score] = matchToTmdb(c.title, c.year);
      if (matchedTmdbId === targetTmdbId && score >= 0.15) {
        return { topicId: c.topicId, slug: c.slug, title: c.title };
      }
    }
  }

  // Fallback: score candidates by Jaccard + hints + year
  let best = candidates[0];
  let bestScore = -99;
  for (const c of candidates) {
    let score = jaccardSimilarity(c.clean, cleanQuery);
    if (qualityHints.test(c.title)) score += 0.2;
    if (penaltyHints.test(c.title)) score -= 0.5;
    if (queryYear && c.year && c.year === queryYear) score += 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return { topicId: best.topicId, slug: best.slug, title: best.title };
}

// ── Scrape topic page for magnets ────────────────────────────────

async function fetchTopicHtml(topicId: number, slug?: string): Promise<string | null> {
  const cleanSlug = slug ? slug.replace(/\/+$/, "") : "";
  const slugSuffix = cleanSlug ? `-${cleanSlug}` : "";
  const url = `${BASE}/index.php?/forums/topic/${topicId}${slugSuffix}/`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  return res.text();
}

async function scrapeTopicPage(topicId: number, slug?: string): Promise<TamilmvResult | null> {
  let html = await fetchTopicHtml(topicId, slug);
  if (!html) return null;

  // If no slug was provided, the page may be a forum listing (not the topic).
  // Try to find the topic link in the HTML, extract its slug, and re-fetch.
  if (!slug) {
    const linkRegex = new RegExp(`/forums/topic/${topicId}-([^"'<&]+)`, "i");
    const linkMatch = html.match(linkRegex);
    if (linkMatch) {
      slug = linkMatch[1].replace(/\/+$/, "");
      html = await fetchTopicHtml(topicId, slug);
      if (!html) return null;
    }
  }

  const magnetRegex = /<a[^>]*class="skyblue-button"[^>]*href="(magnet:[^"]+)"[^>]*>/gi;
  const magnets: string[] = [];
  let m;
  while ((m = magnetRegex.exec(html)) !== null) {
    magnets.push(m[1]);
  }
  if (magnets.length === 0) return null;

  const result: TamilmvResult = { topicId, title: "", year: null, posterUrl: null, torrents: [] };

  for (const rawMagnet of magnets) {
    const magnet = rawMagnet.replace(/&amp;/g, "&");
    const decoded = decodeURIComponent(magnet);
    const dnMatch = decoded.match(/[?&]dn=([^&]+)/);
    const displayName = dnMatch ? decodeURIComponent(dnMatch[1]) : "";

    const xlMatch = decoded.match(/[?&]xl=(\d+)/);
    const bytes = xlMatch ? parseInt(xlMatch[1]) : 0;
    const size = bytes
      ? bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(1)}GB`
        : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(0)}MB`
          : `${(bytes / 1024).toFixed(0)}KB`
      : "Unknown";

    const year = extractYear(displayName);
    if (year) result.year = year;

    const title = cleanTitle(displayName);
    if (!result.title) result.title = title;

    result.torrents.push({
      magnet, quality: parseQuality(displayName), size,
      format: parseFormat(displayName), audio: parseAudio(displayName),
      languages: parseLanguages(displayName),
    });
  }

  result.torrents.sort((a, b) => {
    const rank: Record<string, number> = { "4K": 5, "2160p": 5, "1080p": 4, "720p": 3, "480p": 2, "360p": 1 };
    return (rank[b.quality] || 0) - (rank[a.quality] || 0);
  });

  return result;
}

// ── Exported functions ───────────────────────────────────────────

export async function searchTamilmv(
  tmdbId: number,
  type: "movie" | "tv"
): Promise<TamilmvResult | null> {
  const cached = findInCache(tmdbId, type);
  if (cached) return cached;

  const meta = await getTmdbTitle(tmdbId, type);
  if (!meta || !meta.title) return null;

  const searchQuery = meta.year ? `${meta.title} ${meta.year}` : meta.title;
  const candidates = await search1TamilMV(searchQuery);
  if (candidates.length === 0) return null;

  const found = pickBestCandidate(candidates, searchQuery, tmdbId);
  if (!found) return null;

  const result = await scrapeTopicPage(found.topicId, found.slug);
  if (!result) return null;

  if (!result.title) result.title = meta.title;
  if (!result.year) result.year = meta.year ? parseInt(meta.year) : null;

  setInCache({
    ...result,
    tmdbId,
    type,
    cachedAt: new Date().toISOString(),
  });

  return result;
}

export async function searchQuery(query: string): Promise<TamilmvResult | null> {
  const candidates = await search1TamilMV(query);
  if (candidates.length === 0) return null;

  const found = pickBestCandidate(candidates, query);
  if (!found) return null;

  const result = await scrapeTopicPage(found.topicId, found.slug);
  if (result && !result.title) result.title = found.title;
  return result;
}

export async function scrapeTopicById(topicId: number, slug?: string): Promise<TamilmvResult | null> {
  return scrapeTopicPage(topicId, slug);
}
