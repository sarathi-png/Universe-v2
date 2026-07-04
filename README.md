# NovaStream V2 - Movie Stream Website

A modern movie streaming website with premium features including torrent streaming, TMDB integration, and multi-language support.

## Table of Contents

- [Overview](#overview)
- [Requirements](#requirements)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Deployment](#deployment)

## Overview

NovaStream V2 is a full-featured movie streaming website that combines:

- **Twitch-style streaming interface** with modern React components
- **Multi-language support** for Tamil, Telugu, and Dubbed content
- **TMDB integration** for movie metadata
- **Torrent streaming** using WebTorrent
- **Admin dashboard** for content management
- **Watch history and watchlist** features

## Requirements

### Node.js
- **Version**: `>= 20.0.0`
- Required for both frontend and backend

### Package Manager
- **npm** (recommended)
- **yarn** (alternative)

### Environment Variables
Create a `.env` file in the root directory with the following variables:

```env
# TMDB API Key (required for movie data)
TMDB_API_KEY=your_api_key_here

# Server port (optional, defaults to 3001)
PORT=3001

# Additional API keys for scraping services
# (Add any other required environment variables here)
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd NovaStream-V2
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Install TypeScript globally (for scripts)**
   ```bash
   npm install -g typescript
   ```

## Running the Project

### Development Mode

Run both frontend and backend simultaneously:

```bash
npm run dev
```

This command will:
- Start the Vite development server on `http://localhost:5173`
- Start the TypeScript server on `http://localhost:3001`
- Enable hot module replacement for instant updates

### Production Mode

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start the server**
   ```bash
   npm start
   ```

### Frontend Only

If you want to run only the frontend:

```bash
npm run preview
```

### Backend Only

For API development/testing:

```bash
npm start
```

## Available Scripts

All commands are defined in `package.json`:

| Command | Description |
|---------|-------------|
| `npm run dev` | Run both frontend and backend in development mode |
| `npm run build` | Build the frontend for production |
| `npm run preview` | Preview the built frontend |
| `npm start` | Start the production server |
| `npm run typecheck` | Check TypeScript types |

### Special Scripts

| Command | Description |
|---------|-------------|
| `npm run dubmv:seed` | Seed the database with initial DubMV content |
| `npm run dubmv:crawl` | Crawl for new DubMV content |
| `npm run dubmv:scrape` | Scrape DubMV for content |
| `npm run dubmv:popular` | Generate popular movies list |
| `npm run dubmv:map` | Map popular movies with language data |
| `npm run dubmv:batch` | Batch process content for caching |

## Project Structure

```
Movie Stream Website/Premium-V2/
├── src/
│   ├── api/              # API endpoints
│   ├── components/       # React components
│   ├── hooks/            # Custom hooks
│   ├── layouts/          # Page layouts
│   ├── pages/            # Page components
│   ├── services/         # Application services
│   ├── store/            # Zustand store
│   └── utils/            # Utility functions
├── server/               # Node.js backend
│   ├── data/             # JSON data files
│   ├── routes/           # Express routes
│   ├── scripts/           # Data processing scripts
│   ├── services/          # Scraping services
│   └── utils/             # Utility functions
├── public/               # Static assets
├── node_modules/         # Dependencies
├── dist/                 # Build output (production)
└── config files
```

## Key Features

### Frontend (Vite + React)
- **Modern React 19** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Zustand** for state management
- **TanStack Query** for data fetching
- **React Router** for navigation
- **Video.js integration** for video playback

### Backend (Node.js + TypeScript)
- **Express.js** web framework
- **TypeScript** for type safety
- **CORS** middleware for cross-origin requests
- **JSON caching** with Node-Cache
- **RESTful API** endpoints
- **Error handling** with proper logging

## Configuration

### vite.config.ts
- Configures Vite development server
- Sets up path aliases (`@` for `src/`)
- Proxies `/api` requests to the backend server

### server/index.ts
- Main server file (see detailed documentation in the file)
- Handles API routes
- Serves static frontend files in production
- Provides health check endpoint
- Implements hot retry logic for WebTorrent compatibility

### Directory Structure

1. **src/** - React frontend source code
   - Components are organized by functionality
   - Custom hooks for reusable logic
   - Global state management

2. **server/** - Node.js backend
   - API endpoints for TMDB, language, torrent, and DubMV services
   - Data processing and scraping scripts
   - Services for torrent management and content scraping

3. **Data Files**
   - Language data for multiple languages
   - Seed data for initial popular movies
   - Tamil dubbed content database
   - TMDB-compatible data structures

## Development Tips

### Common Operations

**To warm the language cache on first visit:**
The server automatically pre-scans popular movies (lines 84-100 in `server/index.ts`).

**To regenerate data files:**
```bash
# Generate popular movies list
npm run dubmv:popular

# Map popular movies with language data
npm run dubmv:map

# Batch process for caching
npm run dubmv:batch
```

**To scrape for new content:**
```bash
# Scrape initial seed data
npm run dubmv:scrape

# Crawl for new content (sets start/end range)
npm run dubmv:crawl
```

### Troubleshooting

**Port conflicts**
- If ports 3001 or 5173 are in use, change them in:
  - `package.json` scripts
  - `vite.config.ts` proxy configuration
  - `server/index.ts` PORT variable

**Environment variables missing**
- Ensure `.env` file exists with required keys
- Check for typos in environment variable names

**TypeScript errors**
- Run `npm run typecheck` to check for type issues
- Ensure proper imports/exports between files

## Deployment

### Docker (Recommended)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Manual Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Configure environment variables**
   - Copy `.env.example` to `.env`
   - Update with production values

3. **Start the server**
   ```bash
   npm start
   ```

4. **Configure reverse proxy** (if needed)
   - NGINX
   - Apache
   - Cloudflare

### Environment Variables for Production

| Variable | Purpose | Required |
|----------|---------|----------|
| `TMDB_API_KEY` | TMDB API authentication | Yes |
| `PORT` | Server port | No (default: 3001) |
| Other API keys | Service-specific credentials | Varies |

## API Documentation

The backend provides these endpoints:

- **TMDB API** (`/api/tmdb/...`) - Movie metadata from TMDB
- **Language API** (`/api/language/...`) - Language-specific content
- **Torrent API** (`/api/torrent/...`) - Torrent search and streaming
- **DubMV API** (`/api/dubmv/...`) - Tamil dubbed movie content

## Monitoring

The server includes:
- Health check endpoint: `/api/health`
- Error handling for unhandled rejections and exceptions
- Automatic language cache warming on startup

## Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Test your changes**
5. **Create a pull request**

## Support

For issues, please check:
- [Latest documentation](https://github.com/nova-stream/nova-stream-v2)
- [Issues tracker](https://github.com/nova-stream/nova-stream-v2/issues)
- [Community forums](https://community.nova-stream.io)
