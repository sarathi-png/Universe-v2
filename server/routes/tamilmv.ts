import { Router } from "express";
import { scrapeTopicById, searchQuery, search1TamilMV, pickBestCandidate, scrapeTopicPage } from "../services/tamilmvScraper.js";
import { searchAllV2 } from "../services/scrapers.js";
import { fetchTMDB } from "../utils/tmdb.js";

export const tamilmvRouter = Router();

const ALLOWED_STREAM_DOMAINS = [
  "luluvdo.com",
  "luluvid.com",
  "drakkar.st",
  "dub.onestream.today",
];

function isAllowedStreamUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_STREAM_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

tamilmvRouter.get("/search", async (req, res) => {
  try {
    const q = req.query.q as string | undefined;
    if (!q || q.length < 2) {
      res.status(400).json({ error: "Query param 'q' required (min 2 chars)" });
      return;
    }
    const result = await searchQuery(q);
    if (!result) {
      res.status(404).json({ error: "No matching topic found" });
      return;
    }
    res.json(result);
  } catch (err) {
    console.error("[tamilmv:search]", err);
    res.status(500).json({ error: "Search failed", message: String(err) });
  }
});

tamilmvRouter.get("/sources/:tmdbId", async (req, res) => {
  try {
    const tmdbId = parseInt(req.params.tmdbId);
    const type = (req.query.type as string) || "movie";
    if (!tmdbId) {
      res.status(400).json({ error: "Invalid TMDB ID" });
      return;
    }

    const sources: { url: string; type: string; quality: string; label: string; languages: string[] }[] = [];

    // Single TMDB call shared by both source paths
    let tmdbTitle: string | null = null;
    let tmdbYear: string | null = null;
    try {
      const data = await fetchTMDB<any>(`/${type}/${tmdbId}`);
      tmdbTitle = type === "movie" ? data.title : data.name;
      tmdbYear = (type === "movie" ? data.release_date : data.first_air_date)?.split("-")[0] || null;
    } catch (err) {
      console.error(`[tamilmv:sources] TMDB fetch failed for ${type}/${tmdbId}:`, err);
    }

    // 1. Try 1TamilMV first (Tamil dubbed streaming embeds)
    if (tmdbTitle) {
      try {
        const searchQuery = tmdbYear ? `${tmdbTitle} ${tmdbYear}` : tmdbTitle;
        const candidates = await search1TamilMV(searchQuery);
        if (candidates.length > 0) {
          const found = pickBestCandidate(candidates, searchQuery, tmdbId);
          if (found) {
            const tamilResult = await scrapeTopicPage(found.topicId);
            if (tamilResult?.streams?.length) {
              for (const s of tamilResult.streams) {
                if (!isAllowedStreamUrl(s.url)) {
                  console.warn(`[tamilmv:sources] Blocked stream URL (not in allowlist): ${s.url}`);
                  continue;
                }
                sources.push({
                  url: s.url,
                  type: s.type,
                  quality: s.quality,
                  label: "Tamil Stream",
                  languages: s.languages,
                });
              }
            }
          }
        }
      } catch (err) {
        console.error(`[tamilmv:sources] 1TamilMV scrape failed for "${tmdbTitle}":`, err);
      }
    }

    // 2. Also search general scrapers (YTS etc.) for magnet fallback
    if (tmdbTitle) {
      try {
        const searchQuery = tmdbYear ? `${tmdbTitle} ${tmdbYear}` : tmdbTitle;
        const scraped = await searchAllV2(searchQuery, { limit: 20 });
        for (const t of scraped) {
          const already = sources.some((s) => s.url === t.magnet);
          if (!already && t.seeds > 0) {
            const hasTamil = t.languages.includes("ta") || t.languages.includes("hi") || /tamil|hindi/i.test(t.name);
            sources.push({
              url: t.magnet,
              type: "torrent",
              quality: t.quality,
              label: hasTamil ? "Tamil Torrent" : "Torrent",
              languages: t.languages,
            });
          }
        }
      } catch (err) {
        console.error(`[tamilmv:sources] Scraper fallback failed for "${tmdbTitle}":`, err);
      }
    }

    sources.sort((a, b) => {
      if (a.label.startsWith("Tamil") && !b.label.startsWith("Tamil")) return -1;
      if (!a.label.startsWith("Tamil") && b.label.startsWith("Tamil")) return 1;
      return 0;
    });

    res.json({ tmdbId, sources });
  } catch (err) {
    console.error("[tamilmv:sources]", err);
    res.status(500).json({ error: "Failed to fetch sources", message: String(err) });
  }
});

tamilmvRouter.get("/topic/:id", async (req, res) => {
  try {
    const topicId = parseInt(req.params.id);
    if (!topicId) {
      res.status(400).json({ error: "Invalid topic ID" });
      return;
    }
    const slug = req.query.slug as string | undefined;
    const result = await scrapeTopicById(topicId, slug);
    if (!result) {
      res.status(404).json({ error: "Topic not found or no stream links" });
      return;
    }
    res.json(result);
  } catch (err) {
    console.error("[tamilmv:topic]", err);
    res.status(500).json({ error: "Failed to scrape topic", message: String(err) });
  }
});
