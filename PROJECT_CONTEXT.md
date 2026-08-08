# Project Context — v2-torrent-stream

**Status:** Active
**Last Updated:** 2026-08-07

---

## What This Project Does

NovaStream v2-torrent-stream is a movie streaming web application with torrent-based playback. Users can search for movies, stream content via HLS, and manage their watchlist. Includes a scraping system for movie metadata.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.9.3 |
| Frontend | React 19.2.6 + Vite 7.3.2 |
| Styling | Tailwind CSS 4.1.17 |
| Backend | Express.js 4.22.2 |
| State | Zustand 5.0.14 |
| Data Fetching | TanStack React Query 5.x |
| Media | HLS.js 1.6.16, WebTorrent 3.x |
| Package Manager | npm |
| Fonts | @fontsource/bricolage-grotesque, inter, jetbrains-mono, recursive |

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.2.6 | UI framework |
| react-dom | 19.2.6 | React DOM renderer |
| react-router-dom | 7.16.0 | Client-side routing |
| @tanstack/react-query | 5.100.14 | Server state management |
| zustand | 5.0.14 | Client state management |
| express | 4.22.2 | Backend API server |
| hls.js | 1.6.16 | HLS video streaming |
| webtorrent | 3.0.16 | Torrent client |
| tailwindcss | 4.1.17 | Utility-first CSS |
| framer-motion | 12.40.0 | Animations |
| vite | 7.3.2 | Build tool |
| typescript | 5.9.3 | Type safety |

---

## File Structure

```
v2-torrent-stream/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── pages/              # Route pages
│   ├── hooks/              # Custom hooks
│   ├── stores/             # Zustand stores
│   ├── services/           # API services
│   └── types/              # TypeScript types
├── server/                 # Express backend
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   └── scripts/            # Data scripts
├── public/                 # Static assets
├── index.html              # Entry point
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript config
├── render.yaml             # Render deployment config
└── package.json            # Dependencies
```

---

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite + Express concurrently |
| `npm run build` | Production build with Vite |
| `npm run typecheck` | Type-check without emitting |
| `npm start` | Start Express server only |

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| VITE_API_URL | Yes | Backend API URL |
| PORT | No | Server port (default: 3000) |
| TMDB_API_KEY | Yes | Movie metadata API |

---

## Deployment

- Configured for Render deployment via `render.yaml`
- Build command: `npm run build`
- Start command: `npm start`

---

## Code Conventions

- TypeScript strict mode enabled
- React functional components with hooks
- Path aliases: `@/*` → `src/*`
- API routes return `{ data, error }` pattern
- Use Zod for runtime validation where needed
- Named exports over default exports
