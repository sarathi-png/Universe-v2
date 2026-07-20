import axios from "axios";
import * as cheerio from "cheerio";

const http = axios.create({ timeout: 10000, validateStatus: () => true });
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

function parseSize(str: string): string {
  const m = str.trim().match(/^([\d.]+)\s*(GB|MB|KB|TB)/i);
  if (!m) return "Unknown";
  return `${m[1]} ${m[2].toUpperCase()}`;
}

function extractHash(magnet: string): string | null {
  if (!magnet) return null;
  const m = magnet.match(/btih:([a-fA-F0-9]{40})/);
  return m ? m[1].toLowerCase() : null;
}

// ── YTS API ──────────────────────────────────────────────────────

export async function searchYTS(query: string): Promise<ScrapedTorrent[]> {
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
          name,
          quality,
          size: t.size || "Unknown",
          seeds: t.seeds || 0,
          peers: t.peers || 0,
          source: "YTS",
          languages: detectLanguages(title),
          poster: movie.large_cover_image || movie.medium_cover_image || "",
          year: String(movie.year || ""),
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ── LimeTorrents ─────────────────────────────────────────────────

export async function scrapeLimeTorrents(query: string): Promise<ScrapedTorrent[]> {
  try {
    const url = `https://www.limetorrents.fun/search/all/${encodeURIComponent(query)}/`;
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
        name,
        quality: parseQuality(name),
        size: parseSize(sizeText),
        seeds,
        peers,
        source: "LimeTorrents",
        languages: detectLanguages(name),
      });
    });

    return results.sort((a, b) => b.seeds - a.seeds);
  } catch {
    return [];
  }
}

// ── 1337x ────────────────────────────────────────────────────────

export async function scrape1337x(query: string): Promise<ScrapedTorrent[]> {
  try {
    const url = `https://1337x.to/search/${encodeURIComponent(query)}/1/`;
    const res = await http.get(url, {
      headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.5", Referer: "https://www.google.com/" },
    });
    const $ = cheerio.load(res.data as string);
    const results: ScrapedTorrent[] = [];

    $("table.table-list tbody tr").each((_i, row) => {
      const nameEl = $(row).find("td.name a").last();
      const name = nameEl.text().trim();
      if (!name) return;
      const detailLink = nameEl.attr("href") || "";
      const fullUrl = detailLink.startsWith("http") ? detailLink : `https://1337x.to${detailLink}`;
      const seeds = parseInt($(row).find("td.seeds").text().trim()) || 0;
      const peers = parseInt($(row).find("td.leeches").text().trim()) || 0;
      const sizeText = $(row).find("td.size").text().trim().replace(/[^\d.]+(GB|MB|KB)/i, " $1");
      if (seeds < 1) return;

      results.push({
        magnet: "",
        name,
        quality: parseQuality(name),
        size: sizeText || "Unknown",
        seeds,
        peers,
        source: "1337x",
        languages: detectLanguages(name),
      });

      pendingMagnetUrls.set(fullUrl, results.length - 1);
    });

    return results;
  } catch {
    return [];
  }
}

const pendingMagnetUrls = new Map<string, number>();

export async function resolve1337xMagnets(results: ScrapedTorrent[]): Promise<ScrapedTorrent[]> {
  const updated = [...results];
  const batch = Array.from(pendingMagnetUrls.entries());
  pendingMagnetUrls.clear();
  for (const [detailUrl, idx] of batch) {
    try {
      const res = await http.get(detailUrl, {
        headers: { "User-Agent": UA, Accept: "text/html", Referer: "https://1337x.to/" },
      });
      const $ = cheerio.load(res.data as string);
      const magnet = $('a[href^="magnet:"]').attr("href");
      if (magnet) updated[idx] = { ...updated[idx], magnet };
    } catch {}
  }
  return updated.filter((t) => t.magnet);
}

// ── TPB ──────────────────────────────────────────────────────────

export async function scrapeTPB(query: string): Promise<ScrapedTorrent[]> {
  try {
    const url = `https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=201`;
    const res = await http.get(url);
    const data = res.data as any[];
    if (!Array.isArray(data)) return [];

    const seen = new Set<string>();
    return data
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
  } catch {
    return [];
  }
}

// ── Aggregation (v2 multi-source) ────────────────────────────────

export interface SearchOptions {
  quality?: string;
  lang?: string;
  limit?: number;
}

export async function searchAllV2(query: string, options: SearchOptions = {}): Promise<ScrapedTorrent[]> {
  const { quality, lang, limit = 30 } = options;

  let searchQuery = query;
  if (quality && quality !== "all" && !query.toLowerCase().includes(quality.toLowerCase())) {
    searchQuery = `${query} ${quality}`;
  }

  const [yts, lime, leet, tpb] = await Promise.allSettled([
    searchYTS(searchQuery),
    scrapeLimeTorrents(searchQuery),
    scrape1337x(searchQuery),
    scrapeTPB(searchQuery),
  ]);

  const all: ScrapedTorrent[] = [];
  if (yts.status === "fulfilled") all.push(...yts.value);
  if (lime.status === "fulfilled") all.push(...lime.value);
  if (tpb.status === "fulfilled") all.push(...tpb.value);

  if (leet.status === "fulfilled" && leet.value.length > 0) {
    const resolved = await resolve1337xMagnets(leet.value);
    all.push(...resolved);
  }

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

function qualityRank(q: string): number {
  const ranks: Record<string, number> = { "4K": 5, "2160p": 5, "1080p": 4, "720p": 3, "480p": 2, "360p": 1 };
  return ranks[q] || 0;
}

// ── Original aggregation (backward compat) ───────────────────────

export async function searchAllTorrents(query: string, year?: string): Promise<ScrapedTorrent[]> {
  const yearFiltered = year ? `${query} ${year}` : query;

  const [lime, tpb, leet] = await Promise.allSettled([
    scrapeLimeTorrents(yearFiltered),
    scrapeTPB(query),
    scrape1337x(yearFiltered),
  ]);

  const all: ScrapedTorrent[] = [];
  if (lime.status === "fulfilled") all.push(...lime.value);
  if (tpb.status === "fulfilled") all.push(...tpb.value);

  if (leet.status === "fulfilled" && leet.value.length > 0) {
    const resolved = await resolve1337xMagnets(leet.value);
    all.push(...resolved);
  } else {
    all.push(...(leet.status === "fulfilled" ? leet.value.filter((t) => t.magnet) : []));
  }

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
