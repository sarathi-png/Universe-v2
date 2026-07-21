import { Router } from "express";
import { scrapeTopicById, searchQuery } from "../services/tamilmvScraper.js";

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
