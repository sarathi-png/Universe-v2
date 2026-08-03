import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { dubmvApi } from "../api/dubmv";
import { tmdbApi, IMG } from "../api/tmdb";
import Player from "../components/Player";
import { ChevronLeft, ExternalLink } from "../components/icons";
import { useStore } from "../store/useStore";
import LazyImage from "../components/LazyImage";

export default function DubmvWatch() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const numFileId = Number(fileId);
  const { upsertProgress } = useStore();
  const [sourceIdx, setSourceIdx] = useState(0);

  const passedEntry = (location.state as { entry?: any })?.entry;

  const { data: entry, isLoading } = useQuery({
    queryKey: ["dubmv-entry", numFileId],
    queryFn: async () => {
      try {
        return await dubmvApi.lookup(numFileId);
      } catch {
        return await dubmvApi.scrape(numFileId);
      }
    },
    enabled: !(passedEntry?.directUrl) && !!numFileId,
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });

  const activeEntry = passedEntry?.directUrl ? passedEntry : entry;

  const tmdbId = activeEntry?.tmdbId ?? null;

  const { data: tmdbData } = useQuery({
    queryKey: ["tmdb-dubmv", tmdbId, activeEntry?.type],
    queryFn: () => tmdbApi.details(activeEntry!.type, tmdbId!),
    enabled: !!tmdbId && !!activeEntry,
    staleTime: 1000 * 60 * 10,
  });

  // Fetch TamilMV torrent sources for this movie
  const { data: tamilmvData } = useQuery({
    queryKey: ["tamilmv-sources", tmdbId, activeEntry?.type],
    queryFn: async () => {
      const res = await fetch(`/api/tamilmv/sources/${tmdbId}?type=${activeEntry!.type}`);
      return res.json();
    },
    enabled: !!tmdbId && !!activeEntry,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const torrentSources = (tamilmvData?.sources || []) as {
    magnet: string;
    quality: string;
    size: string;
    label: string;
    languages: string[];
  }[];

  // Build all available sources: DUBMV proxy as primary + torrent magnets
  const allSources = [
    {
      url: dubmvApi.streamUrl(numFileId),
      label: "Direct Stream",
      quality: activeEntry?.quality || "HD",
      size: activeEntry?.fileSize || "",
      isEmbed: false,
    },
    ...torrentSources.map((s) => ({
      url: `/api/torrent/play?magnet=${encodeURIComponent(s.magnet)}`,
      label: `${s.label} (${s.quality})`,
      quality: s.quality,
      size: s.size,
      isEmbed: false,
    })),
  ];

  const currentSource = allSources[sourceIdx] || allSources[0];
  const playerKey = `${numFileId}-${sourceIdx}`;

  if (isLoading || !activeEntry) {
    return (
      <div className="flex min-h-dvh items-center justify-center pt-16">
        <div className="flex items-center gap-3 text-zinc-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pt-16">
      <div className="mx-auto max-w-[1600px] px-3 py-4 md:px-6">
        <button
          onClick={() => navigate("/browse/tamil-dubbed")}
          className="mb-4 flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
        >
          <ChevronLeft width={18} height={18} /> Back to Tamil Dubbed
        </button>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div>
            <Player
              key={playerKey}
              src={currentSource.url}
              poster={tmdbData ? IMG.backdrop(tmdbData.backdrop_path, "w780") : undefined}
              title={activeEntry.title}
              onProgress={(p) => {
                if (tmdbData && p > 0) {
                  upsertProgress({
                    ...tmdbData,
                    media_type: activeEntry.type,
                    progress: Math.min(Math.round(p), 95),
                    updatedAt: Date.now(),
                  });
                }
              }}
            />

            {allSources.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {allSources.map((s, i) => {
                  const isTamil = s.label.includes("Tamil");
                  const isActive = i === sourceIdx;
                  return (
                    <button
                      key={i}
                      onClick={() => setSourceIdx(i)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition ${
                        isActive
                          ? "border-violet-500 bg-violet-500/20 text-white"
                          : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/30"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full shadow-[0_0_8px] ${i === 0 ? "bg-amber-400 shadow-amber-400" : isTamil ? "bg-emerald-400 shadow-emerald-400" : "bg-sky-400 shadow-sky-400"}`} />
                      <span className="font-semibold">{s.label}</span>
                      {isTamil && (
                        <span className="rounded bg-emerald-600/20 px-1 text-[10px] font-semibold text-emerald-300 uppercase">TA</span>
                      )}
                      {s.size && <span className="text-[10px] text-zinc-500">{s.size}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {allSources.length > 1 && sourceIdx > 0 && (
              <p className="mt-2 text-[11px] text-amber-400/70">
                Tip: Direct Stream plays instantly. Torrent sources may buffer depending on network.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold md:text-2xl" style={{ fontFamily: "var(--font-display)" }}>{activeEntry.title}</h1>
              <span className="text-sm text-zinc-400">({activeEntry.year})</span>
              {activeEntry.quality && (
                <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold text-emerald-400">
                  {activeEntry.quality}
                </span>
              )}
              {activeEntry.fileSize && (
                <span className="text-xs text-zinc-500">{activeEntry.fileSize}</span>
              )}
              {activeEntry.duration && (
                <span className="text-xs text-zinc-500">{activeEntry.duration}</span>
              )}
            </div>

            {tmdbData?.overview && (
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{tmdbData.overview}</p>
            )}
          </div>

          <div className="space-y-4">
            {tmdbData && (
              <div className="glass rounded-2xl p-4">
                <div className="flex gap-3">
                  <div className="w-20 shrink-0 overflow-hidden rounded-lg">
                    <LazyImage
                      src={IMG.poster(tmdbData.poster_path, "w300")}
                      alt={activeEntry.title}
                      className="aspect-[2/3] w-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold">{activeEntry.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                      <span>{activeEntry.year}</span>
                      <span>·</span>
                      <span className="capitalize">{activeEntry.type}</span>
                    </div>
                    <p className="mt-2 line-clamp-4 text-xs text-zinc-500">
                      {tmdbData.overview || "No description available."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="glass rounded-2xl p-4">
              <h3 className="mb-2 text-sm font-bold text-white">File Info</h3>
              <div className="space-y-1.5 text-xs text-zinc-400">
                <p>Format: {activeEntry.format || "MP4"}</p>
                <p>Size: {activeEntry.fileSize || "N/A"}</p>
                <p>Duration: {activeEntry.duration || "N/A"}</p>
                <p>Quality: {activeEntry.quality}</p>
                <p>Source: {sourceIdx === 0 ? "IsaiDub / dubmv.xyz" : allSources[sourceIdx]?.label || "Torrent"}</p>
                {sourceIdx > 0 && (
                  <p className="text-emerald-400">Language: {torrentSources[sourceIdx - 1]?.languages?.join(", ").toUpperCase() || "Unknown"}</p>
                )}
                {torrentSources.length > 0 && (
                  <p className="mt-2 text-emerald-400">
                    + {torrentSources.length} torrent source{torrentSources.length > 1 ? "s" : ""} available
                  </p>
                )}
              </div>
            </div>

            <a
              href={`/player/dubmv-proxy/${numFileId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl bg-violet-600/80 p-3 text-sm font-bold text-white transition hover:bg-violet-500"
            >
              <ExternalLink width={16} height={16} />
              Open in new tab
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

