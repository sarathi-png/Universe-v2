import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  IMG,
  title,
  year,
  mediaTypeOf,
  type MediaItem,
  tmdbApi,
} from "../api/tmdb";
import { useStore } from "../store/useStore";
import LazyImage from "./LazyImage";
import { Play, PlusIcon, Check, Star, Info, Volume, Mute } from "./icons";
import { useCardModal } from "./CardModalProvider";
import { smooth } from "../styles/animationPresets";
import { useScrollOffset } from "../hooks/useParallax";

export default function Hero({ items }: { items: MediaItem[] }) {
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [videoKeys, setVideoKeys] = useState<Map<number, string>>(new Map());
  const [showTrailer, setShowTrailer] = useState(false);
  const navigate = useNavigate();
  const { toggleWatchlist, inWatchlist } = useStore();
  const { openCardModal } = useCardModal();
  const featured = items.slice(0, 6);
  const trailerFetched = useRef(new Set<number>());
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!featured.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % featured.length), 8000);
    return () => clearInterval(t);
  }, [featured.length]);

  useEffect(() => {
    setShowTrailer(false);
    const current = featured[idx];
    if (!current || trailerFetched.current.has(current.id)) return;
    trailerFetched.current.add(current.id);
    (async () => {
      try {
        const type = mediaTypeOf(current);
        const details = await tmdbApi.details(type, current.id);
        const trailer = details.videos?.results?.find(
          (v: any) => v.type === "Trailer" && v.site === "YouTube"
        );
        if (trailer) {
          setVideoKeys((prev) => new Map(prev).set(current.id, trailer.key));
        }
      } catch {
        // non-critical
      }
    })();
  }, [idx, featured]);

  useEffect(() => {
    setShowTrailer(false);
    const current = featured[idx];
    if (!current) return;
    const key = videoKeys.get(current.id);
    if (!key) return;
    const t = setTimeout(() => setShowTrailer(true), 3000);
    return () => clearTimeout(t);
  }, [idx, featured, videoKeys]);

  // MUST be before early return — called unconditionally to keep hook order stable
  const glowY1 = useScrollOffset(-30);
  const glowY2 = useScrollOffset(20);

  if (!featured.length) {
    return <div className="h-[85vh] w-full shimmer" />;
  }

  const m = featured[idx];
  const type = mediaTypeOf(m);
  const saved = inWatchlist(m.id);
  const videoKey = videoKeys.get(m.id);
  const showVideo = showTrailer && videoKey;
  return (
    <section
      ref={sectionRef}
      className="relative h-[88vh] min-h-[560px] w-full overflow-hidden"
    >
      {/* Backdrop */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={m.id}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <LazyImage
            src={IMG.backdrop(m.backdrop_path)}
            alt={title(m)}
            className="h-full w-full"
          />
        </motion.div>
      </AnimatePresence>

      {/* Parallax glow layers */}
      <motion.div
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px] animate-float-glow z-10 will-change-transform"
        style={{ y: glowY1 }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-0 right-10 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-[120px] animate-float-glow z-10 will-change-transform"
        style={{ y: glowY2 }}
      />

      {/* YouTube trailer overlay */}
      <AnimatePresence>
        {showVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-40"
          >
            <iframe
              src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${videoKey}&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1`}
              className="pointer-events-none h-full w-full"
              style={{
                border: "none",
                transform: "scale(1.1)",
                filter: "brightness(0.6) contrast(1.1)",
              }}
              allow="autoplay; encrypted-media"
              title="Trailer preview"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-nova-950 via-transparent to-black/40" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Base gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent pointer-events-none z-20" />
      <div className="absolute inset-0 bg-gradient-to-t from-nova-950 via-transparent to-black/40 pointer-events-none z-20" />

      {/* Content */}
      <div className="absolute inset-0 z-10 flex items-center">
        <div className="max-w-2xl px-4 md:px-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={smooth}
            >
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, ...smooth }}
                className="mb-4 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs font-semibold uppercase tracking-widest text-violet-300"
              >
                <Star width={12} height={12} /> {type === "tv" ? "Featured Series" : "Featured Film"}
              </motion.span>

              {/* Animated title */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, ...smooth }}
                className="mb-4 text-4xl font-black leading-none tracking-tighter text-glow md:text-7xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {title(m)}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, ...smooth }}
                className="mb-4 flex flex-wrap items-center gap-3 text-sm font-medium"
              >
                <span className="flex items-center gap-1 text-amber-400">
                  <Star width={14} height={14} />
                  {m.vote_average?.toFixed(1)}
                </span>
                <span className="text-zinc-400">{year(m)}</span>
                <span className="rounded border border-white/20 px-2 py-0.5 text-xs uppercase">
                  {type === "tv" ? "Series" : "Movie"}
                </span>
                <span className="rounded bg-violet-600/30 px-2 py-0.5 text-xs font-bold text-violet-200">
                  4K HDR
                </span>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, ...smooth }}
                className="mb-7 line-clamp-3 max-w-xl text-sm leading-relaxed text-zinc-300 md:text-base"
              >
                {m.overview}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, ...smooth }}
                className="flex flex-wrap items-center gap-3"
              >
                <button
                  onClick={() => navigate(`/sources/${type}/${m.id}`)}
                  className="group relative flex items-center gap-2 overflow-hidden rounded-full bg-white px-7 py-3 text-sm font-bold text-black transition-[transform,shadow] hover:scale-105 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)]"
                >
                  <span className="relative z-10 flex items-center gap-2"><Play width={20} height={20} /> Play Now</span>
                  <div className="absolute inset-0 translate-y-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-transform duration-300 group-hover:translate-y-0" />
                </button>
                <button
                  onClick={() => setShowTrailer(!showVideo)}
                  className="flex items-center gap-2 rounded-full glass px-6 py-3 text-sm font-semibold transition-all hover:bg-white/15 hover:scale-105"
                >
                  <Play width={16} height={16} /> {showVideo ? "Hide Trailer" : "Trailer"}
                </button>
                <button
                  onClick={() => openCardModal(m)}
                  className="flex items-center gap-2 rounded-full glass px-6 py-3 text-sm font-semibold transition-[transform,background] hover:bg-white/15 hover:scale-105"
                >
                  <Info width={18} height={18} /> More Info
                </button>
                <button
                  onClick={() => toggleWatchlist({ ...m, media_type: type })}
                  className="flex h-12 w-12 items-center justify-center rounded-full glass transition-[transform,background] hover:bg-white/15 hover:scale-110"
                  aria-label="Watchlist"
                >
                  {saved ? (
                    <Check width={20} height={20} className="text-emerald-400" />
                  ) : (
                    <PlusIcon width={20} height={20} />
                  )}
                </button>
                {showVideo && (
                    <button
                      onClick={() => setMuted(!muted)}
                      className="flex h-12 w-12 items-center justify-center rounded-full glass transition-[transform,background] hover:bg-white/15 hover:scale-110"
                      aria-label={muted ? "Unmute" : "Mute"}
                  >
                    {muted ? <Mute width={18} height={18} /> : <Volume width={18} height={18} />}
                  </button>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Indicators */}
      <div className="absolute bottom-8 right-4 z-20 flex gap-2 md:right-10">
        {featured.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className="group relative h-1 cursor-pointer"
            aria-label={`Slide ${i + 1}`}
          >
            <span
              className={`absolute inset-0 rounded-full transition-[width] duration-500 ${
                i === idx ? "w-8 bg-violet-400" : "w-4 bg-white/30"
              }`}
            />
            {i === idx && (
              <span
                className="absolute inset-0 rounded-full bg-violet-300"
                style={{
                  width: "100%",
                  animation: "shimmer 8s linear",
                  opacity: 0.5,
                }}
              />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}


