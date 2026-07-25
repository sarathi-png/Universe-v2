import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { IMG, title, type MediaType } from "../api/tmdb";
import { useDetails } from "../hooks/queries";
import { mediaStreamApi } from "../api/stream";
import { ChevronLeft, Play, Info } from "../components/icons";
import LazyImage from "../components/LazyImage";
import { staggerContainer, staggerItem } from "../styles/animationPresets";

export default function Sources() {
  const { type, id } = useParams<{ type: MediaType; id: string }>();
  const navigate = useNavigate();
  const numId = Number(id);
  const { data } = useDetails(type as MediaType, numId);

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!data) return;
    const q = `${title(data)} ${data.release_date?.slice(0, 4) || ""}`;
    setQuery(q);
    (async () => {
      try {
        const res = await mediaStreamApi.searchV2(q, { limit: 10 });
        setResults(res.results || []);
      } catch {
        setResults([]);
      }
      setLoading(false);
    })();
  }, [data]);

  return (
    <div className="min-h-screen pt-20 pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <button
          onClick={() => navigate(`/title/${type}/${numId}`)}
          className="mb-6 flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
        >
          <ChevronLeft width={18} height={18} /> Back to details
        </button>

        {data && (
          <div className="mb-8 flex items-center gap-4">
            <div className="w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
              <LazyImage
                src={IMG.poster(data.poster_path, "w185")}
                alt={title(data)}
                className="aspect-[2/3] w-full"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{title(data)}</h1>
              <p className="text-sm text-zinc-400">{data.release_date?.slice(0, 4)}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="h-20 animate-pulse rounded-xl bg-zinc-800"
              />
            ))}
          </div>
        ) : results.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 py-20 text-zinc-500"
          >
            <Info width={32} height={32} />
            <p className="text-lg">No torrent sources found for "{query}"</p>
            <button
              onClick={() => navigate(`/watch/${type}/${numId}`)}
              className="rounded-full bg-violet-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-violet-500"
            >
              Use Mirror Sources Instead
            </button>
          </motion.div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-3"
          >
            <p className="text-sm text-zinc-400">
              {results.length} torrent source{results.length > 1 ? "s" : ""} found
            </p>
            {results.map((t, i) => (
              <motion.div
                key={i}
                variants={staggerItem}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[border-color,background] hover:border-violet-500/50 hover:bg-white/[0.06]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-violet-600/20 px-2 py-0.5 text-[11px] font-semibold text-violet-300">
                      {t.source || "Torrent"}
                    </span>
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold">
                      {t.quality}
                    </span>
                    {t.languages?.map((l: string) => (
                      <span key={l} className="rounded bg-emerald-600/20 px-2 py-0.5 text-[11px] text-emerald-300 uppercase">
                        {l}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">{t.name}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                    <span>{t.size || "N/A"}</span>
                    <span>⚡ {t.seeds || 0} seeds</span>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/watch/${type}/${numId}?magnet=${encodeURIComponent(t.magnet)}`)}
                  className="flex shrink-0 items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-violet-500"
                >
                  <Play width={14} height={14} /> Play
                </button>
              </motion.div>
            ))}
            <div className="pt-4 text-center">
              <button
                onClick={() => navigate(`/watch/${type}/${numId}`)}
                className="text-sm text-zinc-500 underline transition hover:text-zinc-300"
              >
                Or use mirror sources instead
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
