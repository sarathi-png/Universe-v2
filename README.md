# NovaStream V2

Full-stack movie streaming platform with multi-source torrent search, WebTorrent streaming, TMDB metadata, and language-filtered content.

## Tech Stack

**Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, Zustand, Framer Motion

**Backend:** Express, TypeScript, WebTorrent, Cheerio, TMDB API

## Quick Start

```bash
cp .env.example .env
# Edit .env with your TMDB_API_KEY

npm install
npm run dev    # starts Vite (5173) + server (3001) concurrently
```

## Features

| Feature | Description |
|---------|-------------|
| **Torrent Search** | Searches YTS, 1337x, The Pirate Bay, LimeTorrents simultaneously |
| **Quality Filter** | Filter by 2160p/1080p/720p |
| **Language Filter** | Filter by English, Hindi, Tamil, Telugu, Malayalam, Spanish, more |
| **Torrent Streaming** | WebTorrent with HTTP Range (seek), LRU cache, max 3 concurrent |
| **Render Ready** | Keep-warm pings, health checks, free-tier compatible (512MB) |
| **TMDB Integration** | Posters, backdrops, genres, cast, ratings, recommendations |
| **File Server** | Direct media file streaming via Dahmer API (multi-language) |
| **DUBMV Proxy** | Hindi/Tamil dubbed movie proxy |

## API Endpoints

### Tier 1 — Direct File Server
```
GET /api/language/media/:tmdbId?type=movie&lang=hi
GET /api/language/stream/:tmdbId?lang=hi
GET /api/language/play/:tmdbId?lang=hi
```

### Tier 2 — Torrent Search & Stream (v2 enhanced)
```
GET /api/search/v2?q=Inception&quality=1080p&lang=en&limit=10
GET /api/torrent/search/movie/:tmdbId
GET /api/torrent/search/tv/:tmdbId?season=1&episode=1
GET /api/torrent/play?magnet=...
GET /api/torrent/status
```

### Tier 3 — TMDB
```
GET /api/tmdb/trending/{type}/{window}
GET /api/tmdb/{type}/popular
GET /api/tmdb/{type}/{id}?append_to_response=...
GET /api/tmdb/search/multi?query=...
```

### System
```
GET /api/health
GET /api/status
```

## Deploy to Render

1. Push to GitHub
2. Create **Web Service** on Render
3. Set:
   - **Root Directory:** `(root)`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Add env vars:
   - `TMDB_API_KEY` (required)
   - `NODE_VERSION` = `22`
   - `MAX_ACTIVE_TORRENTS` = `3`
   - `IDLE_TIMEOUT_MS` = `900000`

Render will automatically ping `/api/health` to keep the free tier alive.

## Project Structure

```
├── server/
│   ├── index.ts            # Express entry point
│   ├── routes/             # API route handlers
│   │   ├── tmdb.ts         # TMDB proxy
│   │   ├── language.ts     # Language file server (Dahmer)
│   │   ├── torrent.ts      # Torrent search + stream
│   │   ├── searchV2.ts     # Multi-source search endpoint
│   │   └── dubmv.ts        # DUBMV proxy
│   ├── services/
│   │   ├── scrapers.ts     # YTS + 1337x + TPB + LimeTorrents
│   │   ├── torrentManager.ts # WebTorrent engine + LRU
│   │   ├── languageScanner.ts # Dahmer API scanner
│   │   ├── openScraperEngine.ts # Embed scrapers
│   │   └── streamRemux.ts   # FFmpeg remuxing
│   ├── lib/
│   │   └── keep-warm.ts    # Render sleep prevention
│   ├── utils/
│   └── data/               # Cache files
├── src/                    # React frontend
├── public/
├── render.yaml
├── vite.config.ts
└── package.json
```
