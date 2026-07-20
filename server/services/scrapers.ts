import axios from "axios";
import * as cheerio from "cheerio";
import createHttpsProxyAgent from "https-proxy-agent";

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
const proxyConfig = proxyUrl ? { httpsAgent: createHttpsProxyAgent(proxyUrl), proxy: false } : {};

const http = axios.create({ timeout: 15000, validateStatus: () => true, ...proxyConfig });
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://tracker.dler.org:6969/announce",
  "https://tracker.moeblog.cn:443/announce",
  "https://tracker.zhuqiy.com:443/announce",
  "udp://open.dstud.io:6969/announce",
];

const LANGUAGE_KEYWORDS: [RegExp, string][] = [
  [/\b(hindi|hindub|dual\s*audio)\b/i, "hi"],
  [/\b(tamil|தமிழ்)\b/i, "ta"],
  [/\b(telugu|తెలుగు)\b/i, "te"],
  [/\b(malayalam|മലയാളം)\b/i, "ml"],
  [/\b(kannada|ಕನ್ನಡ)\b/i, "kn"],
  [/\b(english|eng)\b/i, "en"],
  [/\b(spanish|español|castellano)\b/i, "es"],
  [/\b(french|français)\b/i, "fr"],
  [/\b(german|deutsch)\b/i, "de"],
  [/\b(japanese|日本語)\b/i, "ja"],
  [/\b(korean|한국어)\b/i, "ko"],
  [/\b(chinese|中文|mandarin)\b/i, "zh"],
];

export interface ScrapedTorrent {
  magnet: string;
  name: string;
  quality: string;
  size: string;
  seeds: number;
  peers: number;
  source: string;
  languages: string[];
  poster?: string;
  year?: string;
}

function detectLanguages(name: string): string[] {
  const detected = new Set<string>();
  for (const [pattern, code] of LANGUAGE_KEYWORDS) {
    if (pattern.test(name)) detected.add(code);
  }
  if (/\b(multi)\b/i.test(name) || /\b(multi\s*audio)\b/i.test(name)) {
    detected.add("en").add("hi").add("ta").add("te").add("ml");
  }
  return detected.size > 0 ? Array.from(detected) : ["en"];
}

function parseQuality(name: string): string {
  const m = name.match(/\b(2160p|1080p|720p|480p|360p|4[Kk])\b/);
  if (!m) return "HD";
  return m[1].toLowerCase() === "4k" ? "4K" : m[1];
}

function buildMagnet(infoHash: string, name: string): string {
  const parts: string[] = [];
  parts.push(`xt=urn:btih:${infoHash}`);
  parts.push(`dn=${encodeURIComponent(name)}`);
  for (const tr of TRACKERS) parts.push(`tr=${encodeURIComponent(tr)}`);
  return `magnet:?${parts.join("&")}`;
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return "Unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

function extractHash(magnet: string): string | null {
  if (!magnet) return null;
  const m = magnet.match(/btih:([a-fA-F0-9]{40})/);
  return m ? m[1].toLowerCase() : null;
}

function qualityRank(q: string): number {
  const ranks: Record<string, number> = { "4K": 5, "2160p": 5, "1080p": 4, "720p": 3, "480p": 2, "360p": 1 };
  return ranks[q] || 0;
}

// ── YTS API (movie-only) ───────────────────────────────────────────

async function searchYTS(query: string): Promise<ScrapedTorrent[]> {
  try {
    const url = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}&sort_by=seeders&limit=30`;
    const { data } = await http.get(url);
    const movies = data?.data?.movies;
    if (!Array.isArray(movies)) return [];

    const results: ScrapedTorrent[] = [];
    for (const movie of movies) {
      const title = `${movie.title} (${movie.year})`;
      const torrents: any[] = movie.torrents || [];
      for (const t of torrents) {
        if (t.seeds < 1) continue;
        const quality = t.quality === "3D" ? "1080p" : t.quality;
        const name = `${title} [${quality}] [${t.type}] [YTS]`;
        if (!t.hash) continue;
        results.push({
          magnet: buildMagnet(t.hash, name),
          name, quality,
          size: t.size || "Unknown",
          seeds: t.seeds || 0, peers: t.peers || 0,
          source: "YTS",
          languages: detectLanguages(title),
          poster: movie.large_cover_image || movie.medium_cover_image || "",
          year: String(movie.year || ""),
        });
      }
    }
    return results;
  } catch (err) {
    console.error("[scraper:YTS]", (err as any)?.message);
    return [];
  }
}

// ── TPB (apibay, API-based) ────────────────────────────────────────

const TPB_MIRRORS = [
  "https://apibay.org",
  "https://apibay.xyz",
  "https://tpb.party",
  "https://thepiratebay.org",
];

async function searchTPB(query: string): Promise<ScrapedTorrent[]> {
  const errors: string[] = [];
  for (const mirror of TPB_MIRRORS) {
    try {
      const url = `${mirror}/q.php?q=${encodeURIComponent(query)}&cat=201`;
      const res = await http.get(url);
      const data = res.data as any[];
      if (!Array.isArray(data)) continue;

      const seen = new Set<string>();
      const results = data
        .filter((t: any) => t.info_hash && t.name && !seen.has(t.info_hash) && seen.add(t.info_hash))
        .filter((t: any) => Number(t.seeders) > 0)
        .map((t: any) => ({
          magnet: buildMagnet(t.info_hash, t.name),
          name: t.name,
          quality: parseQuality(t.name),
          size: formatSize(Number(t.size) || 0),
          seeds: Number(t.seeders) || 0,
          peers: Number(t.leechers) || 0,
          source: "TPB",
          languages: detectLanguages(t.name),
        }))
        .sort((a, b) => b.seeds - a.seeds);
      if (results.length > 0) return results;
    } catch (err) {
      errors.push(`${mirror}: ${(err as any)?.message}`);
    }
  }
  console.error("[scraper:TPB] all mirrors failed:", errors.join("; "));
  return [];
}

// ── LimeTorrents (cheerio) ─────────────────────────────────────────

const LIME_MIRRORS = [
  "https://www.limetorrents.fun",
  "https://www.limetorrents.info",
  "https://limetorrents.buzz",
];

async function searchLimeTorrents(query: string): Promise<ScrapedTorrent[]> {
  const errors: string[] = [];
  for (const mirror of LIME_MIRRORS) {
    try {
      const url = `${mirror}/search/all/${encodeURIComponent(query)}/`;
      const res = await http.get(url, { headers: { "User-Agent": UA } });
      const $ = cheerio.load(res.data as string);
      const results: ScrapedTorrent[] = [];

      $("table.table2 tr").each((_i, row) => {
        const tds = $(row).find("td");
        if (tds.length < 6) return;
        const nameEl = $(tds[0]).find("div.tt-name a").last();
        const name = nameEl.text().trim();
        if (!name) return;
        const torrentLink = $(tds[0]).find("a.csprite_dl14").attr("href") || "";
        const hash = torrentLink.match(/\/([A-Fa-f0-9]{40})\.torrent/)?.[1]?.toLowerCase();
        if (!hash) return;
        const seeds = parseInt($(tds[3]).text().trim()) || 0;
        if (seeds < 1) return;
        const peers = parseInt($(tds[4]).text().trim()) || 0;
        const sizeText = $(tds[2]).text().trim();

        results.push({
          magnet: buildMagnet(hash, name),
          name, quality: parseQuality(name),
          size: sizeText || "Unknown",
          seeds, peers,
          source: "LimeTorrents",
          languages: detectLanguages(name),
        });
      });

      if (results.length > 0) return results.sort((a, b) => b.seeds - a.seeds);
    } catch (err) {
      errors.push(`${mirror}: ${(err as any)?.message}`);
    }
  }
  console.error("[scraper:LimeTorrents] all mirrors failed:", errors.join("; "));
  return [];
}

// ── 1337x (cheerio + per-item magnet resolve) ──────────────────────

const LEET_MIRRORS = [
  "https://1337x.to",
  "https://1337x.st",
  "https://x1337x.ws",
];

async function search1337x(query: string): Promise<ScrapedTorrent[]> {
  const errors: string[] = [];
  for (const domain of LEET_MIRRORS) {
    try {
      const url = `${domain}/search/${encodeURIComponent(query)}/1/`;
      const res = await http.get(url, {
        headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.5", Referer: "https://www.google.com/" },
      });
      const $ = cheerio.load(res.data as string);
      const items: { name: string; detailUrl: string; seeds: number; peers: number; sizeText: string }[] = [];

      $("table.table-list tbody tr").each((_i, row) => {
        const nameEl = $(row).find("td.name a").last();
        const name = nameEl.text().trim();
        if (!name) return;
        const detailLink = nameEl.attr("href") || "";
        const fullUrl = detailLink.startsWith("http") ? detailLink : `${domain}${detailLink}`;
        const seeds = parseInt($(row).find("td.seeds").text().trim()) || 0;
        if (seeds < 1) return;
        const peers = parseInt($(row).find("td.leeches").text().trim()) || 0;
        const sizeText = $(row).find("td.size").text().trim().replace(/[^\d.]+(GB|MB|KB)/i, " $1");
        items.push({ name, detailUrl: fullUrl, seeds, peers, sizeText });
      });

      if (items.length === 0) continue;

      // Resolve magnets concurrently (up to 5 at a time)
      const results: ScrapedTorrent[] = [];
      const batchSize = 5;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const magnets = await Promise.allSettled(
          batch.map((item) => resolve1337xMagnet(item.detailUrl))
        );
        for (let j = 0; j < batch.length; j++) {
          const magnet = magnets[j].status === "fulfilled" ? magnets[j].value : null;
          results.push({
            magnet: magnet || "",
            name: batch[j].name,
            quality: parseQuality(batch[j].name),
            size: batch[j].sizeText || "Unknown",
            seeds: batch[j].seeds,
            peers: batch[j].peers,
            source: "1337x",
            languages: detectLanguages(batch[j].name),
          });
        }
      }

      const filtered = results.filter((r) => r.magnet).sort((a, b) => b.seeds - a.seeds);
      if (filtered.length > 0) return filtered;
    } catch (err) {
      errors.push(`${domain}: ${(err as any)?.message}`);
    }
  }
  console.error("[scraper:1337x] all mirrors failed:", errors.join("; "));
  return [];
}

async function resolve1337xMagnet(detailUrl: string): Promise<string | null> {
  try {
    const res = await http.get(detailUrl, {
      headers: { "User-Agent": UA, Accept: "text/html", Referer: "https://1337x.to/" },
    });
    const $ = cheerio.load(res.data as string);
    return $('a[href^="magnet:"]').attr("href") || null;
  } catch {
    return null;
  }
}

// ── EZTV API (TV-focused) ──────────────────────────────────────────

async function searchEZTV(query: string): Promise<ScrapedTorrent[]> {
  try {
    const url = `https://eztv.re/api/get-torrents?imdb_id=-1&limit=30&search=${encodeURIComponent(query)}`;
    const res = await http.get(url);
    const data = res.data as any;
    const torrents: any[] = data?.torrents;
    if (!Array.isArray(torrents)) return [];

    return torrents
      .filter((t: any) => t.seeds > 0)
      .map((t: any) => ({
        magnet: t.magnet_url || "",
        name: t.title || t.filename || "",
        quality: parseQuality(t.title || ""),
        size: t.size_bytes ? formatSize(t.size_bytes) : (t.size || "Unknown"),
        seeds: t.seeds || 0,
        peers: t.peers || 0,
        source: "EZTV",
        languages: detectLanguages(t.title || ""),
        year: "",
      }))
      .filter((t: any) => t.magnet)
      .sort((a: any, b: any) => b.seeds - a.seeds);
  } catch (err) {
    console.error("[scraper:EZTV]", (err as any)?.message);
    return [];
  }
}

// ── torrent-search-api (npm package, 13 providers) ─────────────────

let tsaLoaded = false;
let tsaProviders: string[] = [];

async function searchTSA(query: string): Promise<ScrapedTorrent[]> {
  try {
    if (!tsaLoaded) {
      const mod = await import("torrent-search-api");
      const TSA = mod.default || mod;
      TSA.enableProvider("ThePirateBay");
      TSA.enableProvider("1337x");
      TSA.enableProvider("Limetorrents");
      TSA.enableProvider("Eztv");
      TSA.enableProvider("KickassTorrents");
      TSA.enableProvider("Rarbg");
      TSA.enableProvider("Torrent9");
      tsaProviders = TSA.getActiveProviders();
      tsaLoaded = true;
      console.log(`[scraper:TSA] loaded ${tsaProviders.length} providers: ${tsaProviders.join(", ")}`);
    }

    const results = await httpGetJsonFallback(query);
    return results;
  } catch (err) {
    console.error("[scraper:TSA]", (err as any)?.message);
    return [];
  }
}

async function httpGetJsonFallback(query: string): Promise<ScrapedTorrent[]> {
  const mod = await import("torrent-search-api");
  const TSA = mod.default || mod;
  const raw = await TSA.search(query, "Video", 15);

  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t: any) => t.seeds > 0 && t.magnet)
    .map((t: any) => ({
      magnet: t.magnet,
      name: t.title || t.name || "",
      quality: parseQuality(t.title || t.name || ""),
      size: t.size || "Unknown",
      seeds: t.seeds || 0,
      peers: t.peers || 0,
      source: t.provider || "TSA",
      languages: detectLanguages(t.title || t.name || ""),
    }))
    .sort((a: any, b: any) => b.seeds - a.seeds);
}

// ── Sequential fallback chain ──────────────────────────────────────

export interface SearchOptions {
  quality?: string;
  lang?: string;
  limit?: number;
}

/**
 * Try providers in priority order, stop at the first that returns results.
 * Chain: YTS → TPB → LimeTorrents → 1337x → EZTV → torrent-search-api
 */
export async function searchAllV2(query: string, options: SearchOptions = {}): Promise<ScrapedTorrent[]> {
  const { quality, lang, limit = 30 } = options;

  let searchQuery = query;
  if (quality && quality !== "all" && !query.toLowerCase().includes(quality.toLowerCase())) {
    searchQuery = `${query} ${quality}`;
  }

  const chain: { name: string; scrape: (q: string) => Promise<ScrapedTorrent[]> }[] = [
    { name: "TSA", scrape: searchTSA },
    { name: "TPB", scrape: searchTPB },
    { name: "YTS", scrape: searchYTS },
    { name: "LimeTorrents", scrape: searchLimeTorrents },
    { name: "1337x", scrape: search1337x },
    { name: "EZTV", scrape: searchEZTV },
  ];

  for (const scraper of chain) {
    console.log(`[searchV2] Trying ${scraper.name}...`);
    const results = await scraper.scrape(searchQuery);
    if (results.length > 0) {
      console.log(`[searchV2] ${scraper.name} returned ${results.length} results — stopping chain`);
      return applyFilters(results, quality, lang, limit);
    }
    console.log(`[searchV2] ${scraper.name} returned 0 — falling through`);
  }

  return [];
}

function applyFilters(
  all: ScrapedTorrent[],
  quality?: string,
  lang?: string,
  limit?: number
): ScrapedTorrent[] {
  const seen = new Set<string>();
  let filtered = all.filter((t) => {
    const hash = extractHash(t.magnet);
    if (!hash || seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });

  if (quality && quality !== "all") {
    filtered = filtered.filter((r) => r.quality.toLowerCase() === quality.toLowerCase());
  }
  if (lang && lang !== "all") {
    filtered = filtered.filter((r) => r.languages.includes(lang));
  }

  filtered.sort((a, b) => {
    if (b.seeds !== a.seeds) return b.seeds - a.seeds;
    return qualityRank(b.quality) - qualityRank(a.quality);
  });

  return filtered.slice(0, limit);
}

// ── Debug: return per-scraper status ───────────────────────────────

export async function searchAllV2Debug(query: string): Promise<{
  query: string;
  scrapers: Record<string, { status: string; count: number; error?: string }>;
  total: number;
}> {
  const scrapers: Record<string, { status: string; count: number; error?: string }> = {};

  const chain: { name: string; scrape: (q: string) => Promise<ScrapedTorrent[]> }[] = [
    { name: "TSA", scrape: searchTSA },
    { name: "TPB", scrape: searchTPB },
    { name: "YTS", scrape: searchYTS },
    { name: "LimeTorrents", scrape: searchLimeTorrents },
    { name: "1337x", scrape: search1337x },
    { name: "EZTV", scrape: searchEZTV },
  ];

  let all: ScrapedTorrent[] = [];
  for (const scraper of chain) {
    try {
      const results = await scraper.scrape(query);
      scrapers[scraper.name] = { status: "fulfilled", count: results.length };
      all.push(...results);
    } catch (err: any) {
      scrapers[scraper.name] = { status: "rejected", count: 0, error: err.message };
    }
  }

  const seen = new Set<string>();
  all = all.filter((t) => {
    const hash = extractHash(t.magnet);
    if (!hash || seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });

  return { query, scrapers, total: all.length };
}

// ── Original aggregation (backward compat) ─────────────────────────

export async function searchAllTorrents(query: string, year?: string): Promise<ScrapedTorrent[]> {
  const yearFiltered = year ? `${query} ${year}` : query;

  const [lime, tpb, leet] = await Promise.allSettled([
    searchLimeTorrents(yearFiltered),
    searchTPB(query),
    search1337x(yearFiltered),
  ]);

  const all: ScrapedTorrent[] = [];
  if (lime.status === "fulfilled") all.push(...lime.value);
  if (tpb.status === "fulfilled") all.push(...tpb.value);
  if (leet.status === "fulfilled") all.push(...leet.value);

  const seen = new Set<string>();
  return all
    .filter((t) => {
      const hash = extractHash(t.magnet);
      if (!hash || seen.has(hash)) return false;
      seen.add(hash);
      return true;
    })
    .sort((a, b) => {
      const aHasYear = year ? (a.name.includes(year) ? 1 : 0) : 1;
      const bHasYear = year ? (b.name.includes(year) ? 1 : 0) : 1;
      if (aHasYear !== bHasYear) return bHasYear - aHasYear;
      return b.seeds - a.seeds;
    });
}
