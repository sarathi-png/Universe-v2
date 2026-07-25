import { Router } from "express";
import axios from "axios";
import { scrapeTopicById, searchQuery, searchTamilmv } from "../services/tamilmvScraper.js";
import { searchAllV2 } from "../services/scrapers.js";

export const tamilmvRouter = Router();

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

    const sources: { magnet: string; quality: string; size: string; label: string; languages: string[] }[] = [];

    // 1. Try 1TamilMV first (Tamil dubbed content)
    try {
      const tamilResult = await searchTamilmv(tmdbId, type as "movie" | "tv");
      if (tamilResult?.torrents?.length) {
        for (const t of tamilResult.torrents) {
          sources.push({
            magnet: t.magnet,
            quality: t.quality,
            size: t.size,
            label: "Tamil Torrent",
            languages: t.languages,
          });
        }
      }
    } catch {}

    // 2. If few or no TamilMV sources, also search general scrapers (YTS etc.)
    if (sources.length < 3) {
      try {
        const tmdbRes = await axios.get(
          `https://api.themoviedb.org/3/${type}/${tmdbId}`,
          { params: { api_key: process.env.TMDB_API_KEY }, timeout: 5000 }
        );
        const title = type === "movie" ? tmdbRes.data.title : tmdbRes.data.name;
        const year = (type === "movie" ? tmdbRes.data.release_date : tmdbRes.data.first_air_date)?.split("-")[0];
        if (title) {
          const searchQuery = year ? `${title} ${year}` : title;
          const scraped = await searchAllV2(searchQuery, { limit: 15 });
          for (const t of scraped) {
            const already = sources.some((s) => s.magnet === t.magnet);
            if (!already && t.seeds > 0) {
              sources.push({
                magnet: t.magnet,
                quality: t.quality,
                size: t.size,
                label: "Torrent",
                languages: t.languages,
              });
            }
          }
        }
      } catch {}
    }

    res.json({ tmdbId, sources });
  } catch (err) {
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
      res.status(404).json({ error: "Topic not found or no magnet links" });
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to scrape topic", message: String(err) });
  }
});
