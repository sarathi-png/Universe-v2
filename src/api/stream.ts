import axios from "axios";

export interface ApiSubtitleTrack {
  label: string;
  lang: string;
  url: string;
}

export interface MediaStreamSource {
  url: string;
  directUrl: string | null;
  name: string;
  provider: string;
  quality: string;
  languages: string[];
  isEmbed: boolean;
  playUrl: string | null;
  providerId: string;
}

export interface MediaStreamResponse {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;

  sources: MediaStreamSource[];
  subtitles: ApiSubtitleTrack[];
}

const client = axios.create({
  baseURL: "/api/language",
  timeout: 30000,
});

export const mediaStreamApi = {
  getStream: async (
    id: number,
    type: "movie" | "tv",
    season?: number,
    episode?: number,
    lang?: string
  ): Promise<MediaStreamResponse> => {
    const params: Record<string, string | number> = { type };
    if (season != null) params.season = season;
    if (episode != null) params.episode = episode;
    if (lang) params.lang = lang;
    const { data } = await client.get<MediaStreamResponse>(`/media/${id}`, { params });
    return data;
  },

  // New v2 direct search by name with quality + language filter
  searchV2: async (
    query: string,
    options?: { quality?: string; lang?: string; limit?: number }
  ): Promise<{ query: string; quality?: string; lang?: string; count: number; results: any[] }> => {
    const params: Record<string, string> = { q: query };
    if (options?.quality) params.quality = options.quality;
    if (options?.lang) params.lang = options.lang;
    if (options?.limit) params.limit = String(options.limit);
    const { data } = await axios.get("/api/search/v2", { params, timeout: 30000 });
    return data;
  },
};
