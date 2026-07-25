import axios from "axios";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

const TMDB_KEY = () => process.env.TMDB_API_KEY || "";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CONFIG_PATH = resolve(__dirname, "../config/domains.json");
function tamilmvBaseUrl(): string {
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as any;
    return cfg.tamilmv?.baseUrl || "https://www.1tamilmv.promo";
  } catch {
    return "https://www.1tamilmv.promo";
  }
}

const PAREN_YEAR = /\s*\(\d{4}\)\s*/g;

export interface TamilmvStream {
  url: string;
  type: "luluvdo" | "luluvid" | "drakkar";
  quality: string;
  languages: string[];
}

export interface TamilmvResult {
  topicId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  streams: TamilmvStream[];
}

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
  const clean = aggressivelyClean(title).toLowerCase();

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

interface SearchApiResult {
  tid: number;
  title: string;
  priority: boolean;
}

interface Candidate {
  topicId: number;
  title: string;
  clean: string;
  year: number | null;
  priority: boolean;
}

const PENALTY_PATTERNS = /\b(story|trailer|review|explanation|making|behind|scenes|teaser|soundtrack|ost|official\s*trailer)\b/i;

async function search1TamilMV(query: string): Promise<Candidate[]> {
  try {
    const { data } = await axios.get<{ results?: SearchApiResult[] }>(
      `${tamilmvBaseUrl()}/search/api/search.php`,
      {
        params: { q: query, page: 1, sort: "title_asc", direct: 0, priority: 0 },
        headers: { "User-Agent": UA, Referer: `${tamilmvBaseUrl()}/search/` },
        timeout: 15000,
      }
    );
    if (!data || !data.results || data.results.length === 0) return [];

    const seen = new Set<number>();
    const candidates: Candidate[] = [];

    for (const r of data.results) {
      if (seen.has(r.tid) || r.tid === 183) continue;
      seen.add(r.tid);

      if (PENALTY_PATTERNS.test(r.title)) continue;

      const year = extractYear(r.title);
      const clean = aggressivelyClean(r.title);

      candidates.push({ topicId: r.tid, title: r.title, clean, year, priority: r.priority });
    }

    return candidates;
  } catch {
    return [];
  }
}

function pickBestCandidate(
  candidates: Candidate[],
  query: string,
  targetTmdbId?: number
): { topicId: number; title: string } | null {
  if (candidates.length === 0) return null;

  const queryYear = extractYear(query);
  const cleanQuery = query.replace(/[^a-z0-9\s]/gi, "").toLowerCase();

  if (targetTmdbId) {
    for (const c of candidates) {
      const [matchedTmdbId, , score] = matchToTmdb(c.title, c.year);
      if (matchedTmdbId === targetTmdbId && score >= 0.15) {
        return { topicId: c.topicId, title: c.title };
      }
    }
  }

  let best = candidates[0];
  let bestScore = -99;

  for (const c of candidates) {
    let score = jaccardSimilarity(c.clean, cleanQuery);

    if (c.priority) score += 0.15;
    if (queryYear && c.year === queryYear) score += 0.3;
    if (PENALTY_PATTERNS.test(c.title)) score -= 0.5;

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return { topicId: best.topicId, title: best.title };
}

async function fetchTopicHtml(topicId: number, slug?: string): Promise<string | null> {
  const cleanSlug = slug ? slug.replace(/\/+$/, "") : "";
  const slugSuffix = cleanSlug ? `-${cleanSlug}` : "";
  const url = `${tamilmvBaseUrl()}/index.php?/forums/topic/${topicId}${slugSuffix}/`;
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": UA },
      timeout: 15000,
    });
    return typeof data === "string" ? data : String(data);
  } catch {
    return null;
  }
}

async function scrapeTopicPage(topicId: number, slug?: string): Promise<TamilmvResult | null> {
  let html = await fetchTopicHtml(topicId, slug);
  if (!html) return null;

  if (!slug) {
    const linkRegex = new RegExp(`/forums/topic/${topicId}-([^"'<&]+)`, "i");
    const linkMatch = html.match(linkRegex);
    if (linkMatch) {
      slug = linkMatch[1].replace(/\/+$/, "");
      html = await fetchTopicHtml(topicId, slug);
      if (!html) return null;
    }
  }

  const streamUrls: string[] = [];

  const luluvdo = [...html.matchAll(/href="(https:\/\/luluvdo\.com\/e\/[^"]+)"/gi)];
  for (const m of luluvdo) {
    const u = m[1].replace(/&amp;/g, "&");
    if (!streamUrls.includes(u)) streamUrls.push(u);
  }

  const luluvid = [...html.matchAll(/href="(https:\/\/luluvid\.com\/e\/[^"]+)"/gi)];
  for (const m of luluvid) {
    const u = m[1].replace(/&amp;/g, "&");
    if (!streamUrls.includes(u)) streamUrls.push(u);
  }

  const drakkar = [...html.matchAll(/href="(https:\/\/drakkar\.st\/v\/[^"]+)"/gi)];
  for (const m of drakkar) {
    const u = m[1].replace(/&amp;/g, "&");
    if (!streamUrls.includes(u)) streamUrls.push(u);
  }

  if (streamUrls.length === 0) return null;

  const topicTitleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const topicTitle = topicTitleMatch ? topicTitleMatch[1].trim() : "";

  const result: TamilmvResult = {
    topicId,
    title: topicTitle,
    year: extractYear(topicTitle),
    posterUrl: null,
    streams: [],
  };

  for (const url of streamUrls) {
    let type: "luluvdo" | "luluvid" | "drakkar";
    if (url.includes("luluvdo.com")) type = "luluvdo";
    else if (url.includes("luluvid.com")) type = "luluvid";
    else type = "drakkar";

    result.streams.push({
      url,
      type,
      quality: parseQuality(topicTitle),
      languages: parseLanguages(topicTitle),
    });
  }

  return result;
}

export { search1TamilMV, pickBestCandidate, scrapeTopicPage };

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

  const result = await scrapeTopicPage(found.topicId);
  if (!result) return null;

  if (!result.title) result.title = meta.title;
  if (!result.year) result.year = meta.year ? parseInt(meta.year) : null;

  setInCache({ ...result, tmdbId, type, cachedAt: new Date().toISOString() });

  return result;
}

export async function searchQuery(query: string): Promise<TamilmvResult | null> {
  const candidates = await search1TamilMV(query);
  if (candidates.length === 0) return null;

  const found = pickBestCandidate(candidates, query);
  if (!found) return null;

  const result = await scrapeTopicPage(found.topicId);
  if (result && !result.title) result.title = found.title;
  return result;
}

export async function scrapeTopicById(topicId: number, slug?: string): Promise<TamilmvResult | null> {
  return scrapeTopicPage(topicId, slug);
}
