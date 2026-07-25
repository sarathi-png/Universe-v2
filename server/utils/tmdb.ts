import NodeCache from "node-cache";

const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const TMDB_BEARER_TOKEN = process.env.TMDB_BEARER_TOKEN || "";
const BASE_URL = "https://api.themoviedb.org/3";

const cache = new NodeCache({ stdTTL: 300, maxKeys: 500 });

const USE_BEARER = !!TMDB_BEARER_TOKEN;
const AUTH_HEADERS: Record<string, string> = USE_BEARER
  ? { accept: "application/json", Authorization: `Bearer ${TMDB_BEARER_TOKEN}` }
  : { accept: "application/json" };

export async function fetchTMDB<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const query = new URLSearchParams(USE_BEARER ? params : { api_key: TMDB_API_KEY, ...params });
  const url = `${BASE_URL}${endpoint}${query.toString() ? `?${query.toString()}` : ""}`;

  const cached = cache.get<T>(url);
  if (cached) return cached;

  const res = await fetch(url, { headers: AUTH_HEADERS });
  if (!res.ok) {
    throw new Error(`TMDB API error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as T;
  cache.set(url, data);
  return data;
}

export async function fetchMovieTitle(tmdbId: number): Promise<{ title: string; year?: string } | null> {
  try {
    const data = await fetchTMDB<any>(`/movie/${tmdbId}`);
    const year = data.release_date ? data.release_date.split("-")[0] : undefined;
    return { title: data.title, year };
  } catch {
    return null;
  }
}

export async function fetchTVTitle(tmdbId: number): Promise<{ title: string; year?: string } | null> {
  try {
    const data = await fetchTMDB<any>(`/tv/${tmdbId}`);
    const year = data.first_air_date ? data.first_air_date.split("-")[0] : undefined;
    return { title: data.name, year };
  } catch {
    return null;
  }
}

export async function fetchImdbId(tmdbId: number, type: "movie" | "tv"): Promise<string | null> {
  try {
    const data = await fetchTMDB<any>(`/${type}/${tmdbId}/external_ids`);
    return data.imdb_id || null;
  } catch {
    return null;
  }
}
