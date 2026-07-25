import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "./Button";
import { useReducedMotion } from "../../hooks/useReducedMotion";

const GRADIENTS = [
  "from-violet-900/80 to-purple-900/80",
  "from-blue-900/80 to-cyan-900/80",
  "from-emerald-900/80 to-teal-900/80",
  "from-rose-900/80 to-pink-900/80",
  "from-amber-900/80 to-orange-900/80",
  "from-indigo-900/80 to-blue-900/80",
  "from-fuchsia-900/80 to-violet-900/80",
];

function PosterFallback({ title, className }: { title: string; className?: string }) {
  const gradient = GRADIENTS[title.length % GRADIENTS.length];
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br ${gradient} ${className || ""}`} aria-hidden="true">
      <span className="text-4xl font-bold text-white/30 select-none">{title.charAt(0).toUpperCase()}</span>
    </div>
  );
}

interface MovieCardItem {
  title: string;
  year: number;
  tmdbId: number | null;
  posterUrl: string | null;
  quality?: string | null;
  duration?: string | null;
  cached?: boolean;
  fileId?: number | null;
  type?: string;
}

interface MovieCardProps {
  item: MovieCardItem;
  index?: number;
  watchPath?: string;
  showBadge?: boolean;
  onWatch?: (item: MovieCardItem) => void;
  badgeText?: string;
}

const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w342";

export function MovieCard({ item, index = 0, watchPath, showBadge = true, onWatch, badgeText }: MovieCardProps) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [imgFailed, setImgFailed] = useState(false);
  const posterSrc = item.posterUrl?.startsWith("http")
    ? item.posterUrl
    : item.posterUrl?.startsWith("/")
      ? `${TMDB_IMG_BASE}${item.posterUrl}`
      : null;
  const hasPoster = !imgFailed && !!posterSrc;

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 20 }}
      animate={reduced ? {} : { opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { delay: index * 0.03 }}
      className="group relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 transition-all duration-300 hover:ring-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-0.5"
    >
      <div className="relative h-full w-full overflow-hidden">
        {hasPoster ? (
          <img
            src={posterSrc!}
            alt={`${item.title} poster`}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <PosterFallback title={item.title} className="h-full w-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
        <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-0 transition group-hover:opacity-100">
          {item.cached && item.fileId ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => onWatch ? onWatch(item) : watchPath ? navigate(watchPath, { state: { entry: item } }) : undefined}
              className="w-full"
              aria-label={`Watch ${item.title}`}
            >
              Watch Now
            </Button>
          ) : (
            <span className="w-full rounded-lg bg-zinc-800/80 py-2 text-center text-xs font-semibold text-zinc-400 backdrop-blur-sm cursor-default">
              Not Available
            </span>
          )}
        </div>
      </div>

      <div className="absolute left-2 top-2 flex flex-col gap-1" aria-hidden="true">
        {item.quality && (
          <span className="rounded bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 backdrop-blur-sm">
            {item.quality}
          </span>
        )}
        {showBadge && item.cached && item.fileId && !badgeText && (
          <span className="rounded bg-violet-600/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            Ready
          </span>
        )}
        {badgeText && (
          <span className="rounded bg-amber-600/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            {badgeText}
          </span>
        )}
      </div>

      <div className="absolute bottom-1 left-2 right-2">
        <p className="truncate text-sm font-semibold text-white drop-shadow-lg">{item.title}</p>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>{item.year}</span>
          {item.duration && (
            <>
              <span aria-hidden="true">·</span>
              <span>{item.duration}</span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
