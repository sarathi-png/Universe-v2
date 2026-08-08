import { Router, Request, Response } from "express";
import { fetchTMDB } from "../utils/tmdb.js";

export const tmdbRouter = Router();

const VALID_TYPES = new Set(["movie", "tv"]);

function parsePage(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const page = parseInt(String(value || "1"));
  if (!Number.isInteger(page) || page < 1) return "1";
  return String(Math.min(page, 500));
}

function paramStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : String(v ?? "");
}

// Trending
tmdbRouter.get("/trending/:type/:window", async (req: Request, res: Response) => {
  try {
    const type = paramStr(req.params.type);
    const window = paramStr(req.params.window);
    if (!["all", ...VALID_TYPES].includes(type) || !["day", "week"].includes(window)) {
      res.status(400).json({ error: "Invalid type or window" });
      return;
    }
    const page = parsePage(req.query.page);
    const data = await fetchTMDB(`/trending/${type}/${window}`, { page });
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch trending", message: (err as Error).message });
  }
});

// Popular
tmdbRouter.get("/:type/popular", async (req: Request, res: Response) => {
  try {
    const type = paramStr(req.params.type);
    if (!VALID_TYPES.has(type)) {
      res.status(400).json({ error: "Invalid type" });
      return;
    }
    const page = parsePage(req.query.page);
    const region = (req.query.region as string) || "";
    const params: Record<string, string> = { page };
    if (region) params.region = region;
    const data = await fetchTMDB(`/${type}/popular`, params);
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch popular", message: (err as Error).message });
  }
});

// Top Rated
tmdbRouter.get("/:type/top_rated", async (req: Request, res: Response) => {
  try {
    const type = paramStr(req.params.type);
    if (!VALID_TYPES.has(type)) {
      res.status(400).json({ error: "Invalid type" });
      return;
    }
    const page = parsePage(req.query.page);
    const data = await fetchTMDB(`/${type}/top_rated`, { page });
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch top rated", message: (err as Error).message });
  }
});

// Upcoming (movies only)
tmdbRouter.get("/movie/upcoming", async (_req: Request, res: Response) => {
  try {
    const data = await fetchTMDB("/movie/upcoming");
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch upcoming", message: (err as Error).message });
  }
});

// Airing Today (TV only)
tmdbRouter.get("/tv/airing_today", async (_req: Request, res: Response) => {
  try {
    const data = await fetchTMDB("/tv/airing_today");
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch airing today", message: (err as Error).message });
  }
});

// Search — must be BEFORE /:type/:id to avoid catch-all
tmdbRouter.get("/search/multi", async (req: Request, res: Response) => {
  try {
    const query = String(req.query.query || req.query.q || "");
    const page = String(req.query.page || "1");
    if (!query || query.length < 2) {
      res.json({ results: [], total_pages: 0 });
      return;
    }
    const data = await fetchTMDB("/search/multi", { query, page, include_adult: "false" });
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Search failed", message: (err as Error).message });
  }
});

// Season
tmdbRouter.get("/tv/:id/season/:season", async (req: Request, res: Response) => {
  try {
    const id = paramStr(req.params.id); const season = paramStr(req.params.season);
    if (!Number.isInteger(Number(id)) || !Number.isInteger(Number(season))) {
      res.status(400).json({ error: "Invalid id or season" });
      return;
    }
    const data = await fetchTMDB(`/tv/${id}/season/${season}`);
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch season", message: (err as Error).message });
  }
});

// Discover
tmdbRouter.get("/discover/:type", async (req: Request, res: Response) => {
  try {
    const type = paramStr(req.params.type);
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (value && typeof value === "string") params[key] = value;
      else if (value && Array.isArray(value)) params[key] = String(value[0]);
    }
    const data = await fetchTMDB(`/discover/${type}`, params);
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Discover failed", message: (err as Error).message });
  }
});

// Genres
tmdbRouter.get("/genre/:type/list", async (req: Request, res: Response) => {
  try {
    const type = paramStr(req.params.type);
    const data = await fetchTMDB(`/genre/${type}/list`);
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch genres", message: (err as Error).message });
  }
});

// Details — catch-all for /:type/:id, keep at bottom
tmdbRouter.get("/:type/:id", async (req: Request, res: Response) => {
  try {
    const type = paramStr(req.params.type); const id = paramStr(req.params.id);
    if (!VALID_TYPES.has(type) || !Number.isInteger(Number(id))) {
      res.status(400).json({ error: "Invalid type or id" });
      return;
    }
    const data = await fetchTMDB(`/${type}/${id}`, {
      append_to_response:
        "videos,credits,similar,recommendations,reviews,images,release_dates,content_ratings",
      include_image_language: "en,null",
    });
    res.json(data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch details", message: (err as Error).message });
  }
});
