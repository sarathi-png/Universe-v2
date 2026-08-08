import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { tmdbRouter } from "./routes/tmdb.js";
import { languageRouter } from "./routes/language.js";
import { torrentRouter } from "./routes/torrent.js";
import { dubmvRouter } from "./routes/dubmv.js";
import { searchV2Router } from "./routes/searchV2.js";
import { tamilmvRouter } from "./routes/tamilmv.js";
import { KeepWarm } from "./lib/keep-warm.js";
import { rateLimit } from "./middleware/rateLimit.js";

// Prevent WebTorrent microtask crashes from killing the server (Node v24 compat)
const WT_PATTERNS = ["reading 'reserve'", "reading 'missing'"];
function isKnownWtError(err: unknown): boolean {
  const msg = String(err);
  return WT_PATTERNS.some((p) => msg.includes(p));
}

process.on("unhandledRejection", (reason) => {
  if (!isKnownWtError(reason)) {
    console.error("[unhandledRejection] (non-fatal):", reason);
  }
});
process.on("uncaughtException", (err) => {
  if (!isKnownWtError(err)) {
    console.error("[uncaughtException] (non-fatal):", err.message);
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const rawPort = Number(process.env.PORT);
const PORT = Number.isInteger(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : 3001;

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://v2-torrent-stream.onrender.com",
  "https://novastream-v2.onrender.com",
];
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_CORS_ORIGINS;

app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "100kb" }));

// Baseline security headers for all responses
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// Block popups / redirects from embed sources on the watch page
app.use("/watch", (_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; frame-src *; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' https:; connect-src 'self' https:; form-action 'none'; base-uri 'self';"
  );
  next();
});

// API routes
app.use("/api/tmdb", tmdbRouter);
app.use("/api/language", languageRouter);
app.use("/api/torrent", torrentRouter);
app.use("/api/dubmv", dubmvRouter);
app.use("/api/search/v2", searchV2Router);
app.use("/api/tamilmv", tamilmvRouter);

// Rate limit expensive scraping endpoints
app.use(
  "/api/language/scan",
  rateLimit({ windowMs: 60_000, max: 10, message: "Too many scan requests, slow down" })
);
app.use(
  "/api/language/media",
  rateLimit({ windowMs: 60_000, max: 20, message: "Too many media requests, slow down" })
);
app.use(
  "/api/dubmv/scrape",
  rateLimit({ windowMs: 60_000, max: 10, message: "Too many scrape requests, slow down" })
);
app.use(
  "/api/tamilmv",
  rateLimit({ windowMs: 60_000, max: 30, message: "Too many requests, slow down" })
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "2.0.0", timestamp: Date.now() });
});

// Extended status with torrent engine info
app.get("/api/status", async (_req, res) => {
  try {
    const { getTorrentStatus } = await import("./services/torrentManager.js");
    res.json({
      uptime: process.uptime(),
      memory: { rss: Math.round(process.memoryUsage().rss / 1024 / 1024), heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) },
      engine: getTorrentStatus(),
    });
  } catch (err) {
    console.error("[api/status] failed:", err);
    res.json({ uptime: process.uptime(), engine: "unavailable" });
  }
});

// Internal video player page for dubmv proxy (supports seeking)
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

app.get("/player/dubmv-proxy/:fileId", (req, res) => {
  const fileIdRaw = req.params.fileId;
  if (!/^\d+$/.test(fileIdRaw)) {
    res.status(400).send("Invalid file id");
    return;
  }
  const fileId = escapeHtml(fileIdRaw);
  const proxyUrl = `/api/dubmv/proxy/${fileId}`;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>Streaming...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;display:flex;align-items:center;justify-content:center;min-height:100dvh}
video{width:100%;height:100dvh;outline:none}
::-webkit-media-controls-panel{background:#111}
</style>
</head>
<body>
<video controls autoplay preload="metadata" playsinline>
  <source src="${proxyUrl}" type="video/mp4">
</video>
</body>
</html>`);
});

// Serve built frontend in production
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

// Unknown API paths get a JSON 404 (before the SPA fallback)
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`NOVASTREAM V2 server running on http://0.0.0.0:${PORT}`);
  console.log(`  Search:      http://localhost:${PORT}/api/search/v2?q=Inception&quality=1080p`);
  console.log(`  Stream:      http://localhost:${PORT}/api/torrent/play?magnet=...`);
  console.log(`  Language:    http://localhost:${PORT}/api/language/media/{tmdbId}`);
  console.log(`  Health:      http://localhost:${PORT}/api/health`);
  console.log(`  Status:      http://localhost:${PORT}/api/status`);
});

// Keep-warm for Render (prevents free tier sleep)
const warmUrl = process.env.RENDER_EXTERNAL_URL || process.env.KEEP_WARM_URL;
if (warmUrl) {
  const keepWarm = new KeepWarm(`${warmUrl}/api/health`);
  keepWarm.start();
}

// Pre-scan popular movies so language cache is warm on first visit
async function preScanPopular() {
  try {
    const { scanMovie } = await import("./services/languageScanner.js");
    const r = await fetch("https://api.themoviedb.org/3/movie/popular?page=1", {
      headers: process.env.TMDB_API_KEY ? { Authorization: `Bearer ${process.env.TMDB_API_KEY}` } : undefined,
    });
    const data = await r.json() as { results?: { id: number }[] };
    const popularIds = (data.results || []).slice(0, 20).map((m) => m.id);
    console.log(`Pre-scanning ${popularIds.length} popular movies for language data...`);
    await Promise.allSettled(popularIds.map((id) => scanMovie(id, "movie")));
    console.log("Pre-scan complete.");
  } catch (err) {
    console.error("[preScanPopular] failed:", err);
  }
}
preScanPopular();


