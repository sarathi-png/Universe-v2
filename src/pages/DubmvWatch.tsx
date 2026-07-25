import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { dubmvApi } from "../api/dubmv";
import { tmdbApi, IMG } from "../api/tmdb";
import Player from "../components/Player";
import { ChevronLeft, ExternalLink, Film, MagnetIcon } from "../components/icons";
import { useStore } from "../store/useStore";
import LazyImage from "../components/LazyImage";

interface SourceItem {
  url: string;
  label: string;
  quality: string;
  size: string;
  isEmbed: boolean;
  kind: "direct" | "stream" | "torrent";
  streamUrl?: string;
}

const SOURCE_KIND_CONFIG = {
  direct: {
    icon: Film,
    color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400 shadow-amber-400",
    label: "Direct",
  },
  stream: {
    icon: ExternalLink,
    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400 shadow-emerald-400",
    label: "Stream",
  },
  torrent: {
    icon: MagnetIcon,
    color: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    dot: "bg-sky-400 shadow-sky-400",
    label: "Torrent",
  },
};

export default function DubmvWatch() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const numFileId = Number(fileId);
  const { upsertProgress } = useStore();
  const [sourceIdx, setSourceIdx] = useState(0);

  const passedEntry = (location.state as { entry?: any })?.entry;

  const { data: entry, isLoading, isError: entryError } = useQuery({
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

  const rawSources = (tamilmvData?.sources || []) as {
    url: string;
    type: string;
    quality: string;
    label: string;
    languages: string[];
  }[];

  const hasStreaming = rawSources.some(s => s.type === "luluvdo" || s.type === "luluvid" || s.type === "drakkar");
  const hasTorrent = rawSources.some(s => s.type === "torrent");

  const buildSources = (): SourceItem[] => {
    const list: SourceItem[] = [
      {
        url: dubmvApi.streamUrl(numFileId),
        label: "Direct Stream",
        quality: activeEntry?.quality || "HD",
        size: activeEntry?.fileSize || "",
        isEmbed: false,
        kind: "direct",
      },
    ];

    for (const s of rawSources) {
      if (s.type === "luluvdo" || s.type === "luluvid" || s.type === "drakkar") {
        list.push({
          url: "#",
          label: `Tamil Stream (${s.quality})`,
          quality: s.quality,
          size: "",
          isEmbed: false,
          kind: "stream",
          streamUrl: s.url,
        });
      } else if (s.type === "torrent") {
        list.push({
          url: `/api/torrent/play?magnet=${encodeURIComponent(s.url)}`,
          label: `${s.label} (${s.quality})`,
          quality: s.quality,
          size: "",
          isEmbed: false,
          kind: "torrent",
        });
      }
    }

    return list;
  };

  const allSources = buildSources();
  const currentSource = allSources[sourceIdx] || allSources[0];
  const playerKey = `${numFileId}-${sourceIdx}`;

  if (entryError && !activeEntry) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 pt-16 text-zinc-500">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <p className="text-lg font-semibold text-red-400">Failed to load</p>
        <p className="text-sm text-zinc-500">Could not fetch entry data. The file may not exist.</p>
        <button
          onClick={() => navigate("/browse/tamil-dubbed")}
          className="rounded-full bg-violet-600 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Back to Tamil Dubbed
        </button>
      </div>
    );
  }

  if (isLoading || !activeEntry) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-16">
        <div className="flex items-center gap-3 text-zinc-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16">
      <div className="mx-auto max-w-[1600px] px-3 py-4 md:px-6">
        <button
          onClick={() => navigate("/browse/tamil-dubbed")}
          className="mb-4 flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
        >
          <ChevronLeft width={18} height={18} /> Back to Tamil Dubbed
        </button>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div>
            {currentSource.kind === "stream" ? (
              <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-black ring-1 ring-white/10">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08)_0%,transparent_70%)]" />
                <div className="relative z-10 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    <ExternalLink width={22} height={22} className="text-emerald-400" />
                  </div>
                  <p className="text-lg font-bold text-white">Tamil Stream Source</p>
                  <p className="mt-1 text-sm text-zinc-500">Opens in a new tab — click the button below</p>
                </div>
              </div>
            ) : (
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
            )}

            {allSources.length > 1 && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {allSources.map((s, i) => {
                  const config = SOURCE_KIND_CONFIG[s.kind];
                  const Icon = config.icon;
                  const isStream = s.kind === "stream";
                  const isActive = !isStream && i === sourceIdx;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (isStream && s.streamUrl) {
                          window.open(s.streamUrl, "_blank", "noopener");
                        } else {
                          setSourceIdx(i);
                        }
                      }}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm transition ${
                        isActive
                          ? "border-violet-500 bg-violet-500/20 text-white"
                          : isStream
                            ? "border-emerald-500/20 bg-emerald-500/5 text-zinc-300 hover:border-emerald-500/40 hover:bg-emerald-500/10"
                            : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/30"
                      }`}
                    >
                      <Icon width={16} height={16} className={isStream ? "text-emerald-400" : isActive ? "text-white" : "text-zinc-500"} />
                      <span className="text-[11px] font-semibold leading-tight">{s.label}</span>
                      {!isStream && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${config.color}`}>
                          {config.label}
                        </span>
                      )}
                      {isStream && (
                        <span className="rounded bg-emerald-600/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                          New Tab
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {allSources.length > 1 && sourceIdx > 0 && (
              <p className="mt-2 text-[11px] text-zinc-500">
                <span className="text-amber-400/70">Tip:</span> Direct Stream plays instantly. Torrent sources may buffer depending on network.
              </p>
            )}
            {hasStreaming && (
              <p className="mt-1 text-[11px] text-emerald-400/60">
                Tamil Stream sources open in a new tab via 1TamilMV player.
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
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

            {allSources.length > 1 && (
              <div className="mt-4 flex items-center gap-4 border-t border-white/5 pt-4 text-xs text-zinc-500">
                <span>{allSources.length} source{allSources.length > 1 ? "s" : ""} available</span>
                <span className="h-1 w-1 rounded-full bg-zinc-700" />
                <span>
                  {currentSource.kind === "direct" && "Playing from dubmv.xyz"}
                  {currentSource.kind === "torrent" && "Streaming from torrent"}
                </span>
              </div>
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
              <h3 className="mb-3 text-sm font-bold text-white">File Info</h3>
              <div className="divide-y divide-white/5">
                {[
                  { label: "Format", value: activeEntry.format || "MP4" },
                  { label: "Size", value: activeEntry.fileSize || "N/A" },
                  { label: "Duration", value: activeEntry.duration || "N/A" },
                  { label: "Quality", value: activeEntry.quality },
                  { label: "Source", value: sourceIdx === 0 ? "IsaiDub / dubmv.xyz" : currentSource.label },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-zinc-500">{row.label}</span>
                    <span className="text-zinc-300 font-medium">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {hasTorrent && (
              <div className="glass rounded-2xl p-4">
                <h3 className="mb-2 text-sm font-bold text-white">Additional Sources</h3>
                <div className="space-y-2">
                  {hasStreaming && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400/80">
                      <ExternalLink width={12} height={12} />
                      <span>+{rawSources.filter(s => s.type !== "torrent").length} Tamil Stream source{rawSources.filter(s => s.type !== "torrent").length > 1 ? "s" : ""}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-sky-400/80">
                    <MagnetIcon width={12} height={12} />
                    <span>+{rawSources.filter(s => s.type === "torrent").length} torrent source{rawSources.filter(s => s.type === "torrent").length > 1 ? "s" : ""} (English)</span>
                  </div>
                </div>
              </div>
            )}

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
