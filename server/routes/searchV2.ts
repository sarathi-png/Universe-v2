import { Router } from "express";
import { searchByName } from "../services/torrentManager.js";

export const searchV2Router = Router();

searchV2Router.get("/", async (req, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q) {
      res.status(400).json({ error: 'Missing "q" parameter' });
      return;
    }

    const quality = (req.query.quality as string) || "all";
    const lang = (req.query.lang as string) || "all";
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 50);

    console.log(`[searchV2] q="${q}" quality=${quality} lang=${lang}`);

    const results = await searchByName(q, {
      quality: quality !== "all" ? quality : undefined,
      lang: lang !== "all" ? lang : undefined,
      limit,
    });

    res.json({
      query: q,
      quality: quality !== "all" ? quality : undefined,
      lang: lang !== "all" ? lang : undefined,
      count: results.length,
      results,
    });
  } catch (err: any) {
    console.error("[searchV2] Error:", err);
    res.status(500).json({ error: "Search failed", message: err.message });
  }
});
