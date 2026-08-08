import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  IMG,
  title,
  year,
  type MediaType,
} from "../api/tmdb";
import { useDetails } from "../hooks/queries";
import { useStore } from "../store/useStore";
import LazyImage from "../components/LazyImage";
import Row from "../components/Row";
import { Play, PlusIcon, Check, Star, Clock } from "../components/icons";
import ContentRatingBadge from "../components/ContentRatingBadge";
import ParticleCanvas from "../components/ParticleCanvas";

export default function Details() {
  const { type, id } = useParams<{ type: MediaType; id: string }>();
  const navigate = useNavigate();
  const mt: MediaType = type === "movie" || type === "tv" ? type : "movie";
  const numId = Number(id);
  const validId = Number.isInteger(numId) && numId > 0;
  const { data, isLoading } = useDetails(mt, numId, { enabled: validId });
  const { toggleWatchlist, inWatchlist } = useStore();
  const [tab, setTab] = useState<"overview" | "cast" | "reviews">("overview");

  if (isLoading || !data) {
    return (
      <div className="min-h-dvh pt-16">
        <div className="h-[60vh] w-full shimmer" />
      </div>
    );
  }

  const saved = inWatchlist(numId);
  const trailer = data.videos?.results?.find(
    (v: any) => v.type === "Trailer" && v.site === "YouTube"
  );
  const cast = data.credits?.cast?.slice(0, 16) || [];
  const similar = data.similar?.results || [];
  const recommended = data.recommendations?.results || [];
  const reviews = data.reviews?.results?.slice(0, 4) || [];
  const runtime = data.runtime || data.episode_run_time?.[0];

  const sectionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] } as any,
    }),
  };

  return (
    <div className="relative pb-20 md:pb-10">
      <ParticleCanvas className="absolute inset-0 z-0" count={45} />
      <div className="relative z-10">
        {/* Cinematic backdrop */}
      <div className="relative h-[55vh] sm:h-[65vh] md:h-[75vh] min-h-[380px] sm:min-h-[450px] md:min-h-[520px] w-full">
        <LazyImage
          src={IMG.backdrop(data.backdrop_path)}
          alt={title(data)}
          className="h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-nova-950 via-nova-950/40 to-black/50" />
        <div className="absolute inset-0 bg-gradient-to-r from-nova-950 via-transparent to-transparent" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-48 w-48 md:h-96 md:w-96 rounded-full bg-violet-700/20 blur-[100px] md:blur-[140px]" />

        <div className="absolute bottom-0 w-full px-3 sm:px-4 md:px-10">
          <div className="flex flex-col gap-4 sm:gap-6 pb-6 sm:pb-10 md:flex-row md:items-end">
            <div className="hidden w-32 sm:w-40 md:w-48 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-2xl sm:block">
              <LazyImage
                src={IMG.poster(data.poster_path)}
                alt={title(data)}
                className="aspect-[2/3] w-full"
              />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex-1 min-w-0"
            >
              <h1 className="mb-2 md:mb-3 text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black tracking-tighter text-glow font-display">
                {title(data)}
              </h1>
              {data.tagline && (
                <p className="mb-2 md:mb-3 italic text-violet-300 text-sm md:text-base">{data.tagline}</p>
              )}
              <div className="mb-3 md:mb-4 flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm">
                <span className="flex items-center gap-1 font-semibold text-amber-400">
                  <Star width={13} height={13} className="md:w-[15px] md:h-[15px]" />
                  {data.vote_average?.toFixed(1)}
                </span>
                <span className="text-zinc-400">{year(data)}</span>
                <ContentRatingBadge data={data} mediaType={mt} />
                {runtime && (
                  <span className="flex items-center gap-1 text-zinc-400">
                    <Clock width={12} height={12} className="md:w-[14px] md:h-[14px]" /> {runtime}m
                  </span>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {data.genres?.slice(0, 3).map((g: any) => (
                    <span
                      key={g.id}
                      className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] md:text-xs"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <button
                  onClick={() => navigate(`/sources/${mt}/${numId}`)}
                  className="flex items-center gap-2 rounded-full bg-white px-5 md:px-8 py-2.5 md:py-3 text-xs md:text-sm font-bold text-black transition hover:scale-105"
                >
                  <Play width={16} height={16} className="md:w-[20px] md:h-[20px]" /> Watch
                </button>
                <button
                  onClick={() => toggleWatchlist({ ...data, media_type: mt })}
                  aria-label={saved ? "Remove from watchlist" : "Add to watchlist"}
                  className="flex items-center gap-2 rounded-full glass px-4 md:px-5 py-2.5 md:py-3 text-xs md:text-sm font-semibold transition hover:bg-white/15"
                >
                  {saved ? (
                    <>
                      <Check width={16} height={16} className="md:w-[18px] md:h-[18px] text-emerald-400" />
                    </>
                  ) : (
                    <>
                      <PlusIcon width={16} height={16} className="md:w-[18px] md:h-[18px]" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-10">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-white/10">
          {(["overview", "cast", "reviews"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-3 text-sm font-semibold capitalize transition ${
                tab === t ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t}
              {tab === t && (
                <motion.span
                  layoutId="tab"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-violet-500"
                />
              )}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <motion.div
            variants={sectionVariants} custom={0} initial="hidden" animate="visible"
            className="grid gap-8 lg:grid-cols-3"
          >
            <div className="lg:col-span-2">
              <p className="max-w-3xl leading-relaxed text-zinc-300">
                {data.overview}
              </p>
              {trailer && (
                <div className="mt-6 aspect-video w-full max-w-3xl overflow-hidden rounded-2xl ring-1 ring-white/10">
                  <iframe
                    src={`https://www.youtube.com/embed/${trailer.key}`}
                    title="Trailer"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="h-full w-full"
                  />
                </div>
              )}
            </div>
            <div className="space-y-3 text-sm">
              <div className="glass rounded-2xl p-4">
                <h3 className="mb-3 font-bold">Details</h3>
                {data.status && (
                  <Detail label="Status" value={data.status} />
                )}
                {data.original_language && (
                  <Detail
                    label="Language"
                    value={data.original_language.toUpperCase()}
                  />
                )}
                {data.number_of_seasons && (
                  <Detail label="Seasons" value={data.number_of_seasons} />
                )}
                {data.budget > 0 && (
                  <Detail
                    label="Budget"
                    value={`$${(data.budget / 1e6).toFixed(1)}M`}
                  />
                )}
                {data.production_companies?.[0] && (
                  <Detail
                    label="Studio"
                    value={data.production_companies[0].name}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}

        {tab === "cast" && (
          <motion.div
            variants={sectionVariants} custom={0} initial="hidden" animate="visible"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
          >
            {cast.map((c: any) => (
              <Link
                key={c.id}
                to={`/search?q=${encodeURIComponent(c.name)}`}
                className="group text-center"
              >
                <div className="mx-auto mb-2 aspect-square w-full overflow-hidden rounded-2xl ring-1 ring-white/10 transition group-hover:ring-violet-500/50">
                  <LazyImage
                    src={IMG.profile(c.profile_path)}
                    fallbackText={c.name}
                    alt={c.name}
                    className="h-full w-full"
                  />
                </div>
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="truncate text-xs text-zinc-500">{c.character}</p>
              </Link>
            ))}
          </motion.div>
        )}

        {tab === "reviews" && (
          <motion.div
            variants={sectionVariants} custom={0} initial="hidden" animate="visible"
            className="grid gap-4 md:grid-cols-2"
          >
            {reviews.length ? (
              reviews.map((r: any) => (
                <div key={r.id} className="glass rounded-2xl p-5">
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 font-bold">
                      {(r.author?.[0] || "?").toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{r.author}</p>
                      {r.author_details?.rating && (
                        <p className="flex items-center gap-1 text-xs text-amber-400">
                          <Star width={11} height={11} />
                          {r.author_details.rating}/10
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="line-clamp-5 text-sm leading-relaxed text-zinc-400">
                    {r.content}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-zinc-500">No reviews yet.</p>
            )}
          </motion.div>
        )}
      </div>

      <div className="mt-10">
        {recommended.length > 0 && (
          <Row title="Recommended For You" items={recommended} />
        )}
        {similar.length > 0 && (
          <Row title="More Like This" items={similar} />
        )}
      </div>
      </div>
      </div>
  );
}

function Detail({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between border-b border-white/5 py-1.5 last:border-0">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-200">{value}</span>
    </div>
  );
}
