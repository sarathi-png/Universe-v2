import { useQuery } from "@tanstack/react-query";
import { tmdbApi, type MediaType } from "../api/tmdb";

const opts = { staleTime: 1000 * 60 * 10, gcTime: 1000 * 60 * 30 };

export const useTrending = (w: "day" | "week" = "week") =>
  useQuery({ queryKey: ["trending", w], queryFn: () => tmdbApi.trending(w), ...opts });

export const usePopular = (type: MediaType) =>
  useQuery({ queryKey: ["popular", type], queryFn: () => tmdbApi.popular(type), ...opts });

export const useTopRated = (type: MediaType) =>
  useQuery({ queryKey: ["topRated", type], queryFn: () => tmdbApi.topRated(type), ...opts });

export const useUpcoming = () =>
  useQuery({ queryKey: ["upcoming"], queryFn: () => tmdbApi.upcoming(), ...opts });

export const useAiringToday = () =>
  useQuery({ queryKey: ["airing"], queryFn: () => tmdbApi.airingToday(), ...opts });

export const useDiscover = (type: MediaType, params: Record<string, any>, enabled = true) =>
  useQuery({
    queryKey: ["discover", type, params],
    queryFn: () => tmdbApi.discover(type, params).then((d) => d.results),
    enabled,
    ...opts,
  });

export const useDetails = (
  type: MediaType,
  id: number,
  options?: { enabled?: boolean }
) =>
  useQuery({
    queryKey: ["details", type, id],
    queryFn: () => tmdbApi.details(type, id),
    enabled: options?.enabled ?? true,
    ...opts,
  });

export const useGenres = (type: MediaType) =>
  useQuery({ queryKey: ["genres", type], queryFn: () => tmdbApi.genres(type), ...opts });

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ["search", q],
    queryFn: () => tmdbApi.search(q).then((d) => d.results),
    enabled: q.trim().length > 1,
    ...opts,
  });


