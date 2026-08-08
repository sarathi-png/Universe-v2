import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  IMG,
  title,
  year,
  mediaTypeOf,
  type MediaItem,
  type MediaType,
} from "../api/tmdb";
import { useDetails } from "../hooks/queries";
import { useStore } from "../store/useStore";
import { Play, PlusIcon, Check, Close } from "./icons";
import ContentRatingBadge, { getCertification } from "./ContentRatingBadge";
import CastRow from "./CastRow";
import Button from "./Button";

interface CardModalProps {
  isOpen: boolean;
  item: MediaItem | null;
  onClose: () => void;
}

export default function CardModal({ isOpen, item, onClose }: CardModalProps) {
  const navigate = useNavigate();
  const { toggleWatchlist, inWatchlist } = useStore();
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const type = item ? mediaTypeOf(item) : "movie";
  const { data: detail } = useDetails(type as MediaType, item?.id ?? 0, {
    enabled: isOpen && item != null && Number.isFinite(item.id) && item.id > 0,
  });

  // Focus trap for accessibility (WCAG 2.4.3)
  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return [];
    return Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
  }, []);

  useEffect(() => {
    if (isOpen) {
      setExpandedDesc(false);
      setImgLoaded(false);
      document.body.style.overflow = "hidden";
      // Focus the modal container after render
      requestAnimationFrame(() => {
        const focusable = getFocusableElements();
        if (focusable.length > 0) focusable[0].focus();
        else modalRef.current?.focus();
      });
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen, getFocusableElements]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab") {
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, getFocusableElements]);

  if (!item) return null;

  const name = title(item);
  const itemYear = year(item);
  const backdrop = detail?.backdrop_path || item.backdrop_path;
  const poster = detail?.poster_path || item.poster_path;
  const genres = detail?.genres || [];
  const overview = detail?.overview || item.overview || "";
  const rating = detail?.vote_average ?? item.vote_average ?? 0;
  const runtime = detail?.runtime;
  const cast = detail?.credits?.cast?.slice(0, 20) || [];
  const recs = detail?.recommendations?.results?.slice(0, 10) || [];
  const certification = getCertification(detail, type);
  const saved = inWatchlist(item.id);

  const ratingColor = rating >= 7 ? "#22c55e" : rating >= 5 ? "#eab308" : "#ef4444";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/85" />

          <motion.div
            ref={modalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={name}
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl bg-surface border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.8)] mx-2 sm:mx-0 outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 p-1.5 sm:p-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Close width={16} height={16} className="sm:w-[20px] sm:h-[20px]" />
            </button>

            {/* Backdrop section */}
            <div className="relative h-[25vh] sm:h-[35vh] md:h-[45vh] overflow-hidden rounded-t-2xl sm:rounded-t-3xl">
              {backdrop ? (
                <img
                  src={IMG.backdrop(backdrop, "w1280")}
                  alt={name}
                  loading="lazy"
                  className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setImgLoaded(true)}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : (
                <div className="absolute inset-0 bg-zinc-900" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-surface/80 to-transparent" />

              <div className="absolute -bottom-12 sm:-bottom-14 md:-bottom-16 left-4 sm:left-6 md:left-8 z-20 flex items-end gap-4 sm:gap-5">
                <div className="w-20 sm:w-24 md:w-32 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex-shrink-0 aspect-[2/3]">
                  {poster && (
                    <img src={IMG.poster(poster)} alt={name} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="pt-16 sm:pt-20 px-4 sm:px-6 md:px-8 pb-6 sm:pb-8 space-y-4 sm:space-y-6">
              <div className="space-y-2 sm:space-y-3">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-tight font-display">{name}</h2>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  {itemYear && <span className="text-white/50">{itemYear}</span>}
                  {certification && (
                    <ContentRatingBadge data={detail} mediaType={type} />
                  )}
                  {runtime && <span className="text-white/50">{Math.floor(runtime / 60)}h {runtime % 60}m</span>}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `conic-gradient(${ratingColor} ${rating * 10}%, rgba(255,255,255,0.1) 0%)`, padding: "2px" }}
                    >
                      <div className="w-full h-full rounded-full bg-surface/90 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-white">{Math.round(rating * 10)}%</span>
                      </div>
                    </div>
                    <span className="text-white/70 text-xs">User Score</span>
                  </div>
                </div>
                {genres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {genres.map((g: any) => (
                      <span key={g.id} className="px-3 py-1 text-xs rounded-full bg-white/10 text-white/70 border border-white/5">
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => { navigate(`/sources/${type}/${item.id}`); onClose(); }}
                >
                  <Play width={20} height={20} className="fill-white" />
                  Watch Now
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => { navigate(`/title/${type}/${item.id}`); onClose(); }}
                >
                  More Info
                </Button>
                <Button
                  variant="icon"
                  onClick={(e) => { e.stopPropagation(); toggleWatchlist({ ...item, media_type: type }); }}
                >
                  {saved ? (
                    <Check width={20} height={20} className="text-emerald-400" />
                  ) : (
                    <PlusIcon width={20} height={20} className="text-white/60" />
                  )}
                </Button>
              </div>

              {overview && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Synopsis</h3>
                  <div className="relative">
                    <p className={`text-sm text-white/60 leading-relaxed ${!expandedDesc ? "line-clamp-3" : ""}`}>
                      {overview}
                    </p>
                    {overview.length > 200 && (
                      <button
                        onClick={() => setExpandedDesc(!expandedDesc)}
                        className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 mt-1 transition-colors"
                      >
                        {expandedDesc ? "Show less" : "Show more"}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5">
                          {expandedDesc ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {cast.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Cast</h3>
                  <CastRow cast={cast} />
                </div>
              )}

              {recs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">You May Also Like</h3>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {recs.map((rec: any) => (
                      <button
                        key={rec.id}
                        onClick={() => { navigate(`/title/${mediaTypeOf(rec)}/${rec.id}`); onClose(); }}
                        className="flex-shrink-0 w-28 group text-left"
                      >
                        <div className="aspect-[2/3] rounded-xl overflow-hidden bg-zinc-800 mb-2 group-hover:ring-2 ring-violet-500 transition-shadow">
                          {rec.poster_path ? (
                            <img
                              src={IMG.poster(rec.poster_path, "w200")}
                              alt={title(rec)}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/10 text-4xl font-bold">?</div>
                          )}
                        </div>
                        <p className="text-xs text-white/70 line-clamp-1 group-hover:text-violet-300 transition-colors">
                          {title(rec)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
