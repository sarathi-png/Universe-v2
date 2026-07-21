import { writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

const TMDB_KEY = process.env.TMDB_API_KEY || "";
const TMDB = "https://api.themoviedb.org/3";

interface SeedEntry {
  tmdbId: number;
  title: string;
  year: number;
  type: "movie" | "tv";
  popularity: number;
  posterPath: string | null;
}

async function fetchTmdb(endpoint: string): Promise<any[]> {
  const results: any[] = [];
  for (let page = 1; page <= 3; page++) {
    try {
      const res = await fetch(
        `${TMDB}${endpoint}?api_key=${TMDB_KEY}&page=${page}&language=en-US`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) break;
      const data = await res.json();
      results.push(...(data.results || []));
    } catch {
      break;
    }
  }
  return results;
}

async function main() {
  if (!TMDB_KEY || TMDB_KEY === "test") {
    console.error("Set a valid TMDB_API_KEY env var");
    process.exit(1);
  }

  console.log("Fetching popular movies...");
  const movies = await fetchTmdb("/movie/popular");
  const topRated = await fetchTmdb("/movie/top_rated");
  const trending = await fetchTmdb("/trending/movie/week");
  const nowPlaying = await fetchTmdb("/movie/now_playing");

  const seen = new Set<number>();
  const seed: SeedEntry[] = [];

  const all = [...movies, ...topRated, ...trending, ...nowPlaying];
  for (const m of all) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    seed.push({
      tmdbId: m.id,
      title: m.title || m.name || "",
      year: parseInt((m.release_date || "").split("-")[0]) || 0,
      type: "movie",
      popularity: m.popularity || 0,
      posterPath: m.poster_path || null,
    });
  }

  seed.sort((a, b) => b.popularity - a.popularity);
  const top200 = seed.slice(0, 200);

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, "popular-seed.json"), JSON.stringify(top200, null, 2));
  console.log(`Saved ${top200.length} popular movies to popular-seed.json`);
}

main().catch(console.error);
