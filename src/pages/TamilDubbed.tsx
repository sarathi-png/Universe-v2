import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { dubmvApi } from "../api/dubmv";
import { MovieCard } from "../components/ui/MovieCard";
import { Button } from "../components/ui/Button";

function parseDuration(duration: string | null): number {
  if (!duration || duration.toLowerCase().includes("not available")) return 0;
  const str = duration.toLowerCase();
  if (str.includes(":")) {
    const parts = str.split(":").map(p => p.trim()).filter(p => p);
    if (parts.length === 2) {
      return parseFloat(parts[0]) + (parseFloat(parts[1].replace("min", "")) || 0) / 60;
    } else if (parts.length === 3) {
      return (parseFloat(parts[0]) * 60) + parseFloat(parts[1]) + (parseFloat(parts[2].replace("min", "")) || 0) / 60;
    }
  } else {
    const match = str.match(/(\d+(?:\.\d+)?)/);
    if (match) return parseFloat(match[1]);
  }
  return 0;
}

export default function TamilDubbed() {
  const [search, setSearch] = useState("");
  const [showAllCached, setShowAllCached] = useState(false);

  const { data: popularData, isLoading: popularLoading, isError: popularError } = useQuery({
    queryKey: ["tamil-dubbed-popular"],
    queryFn: () => dubmvApi.popular(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: cachedData, isError: cachedError } = useQuery({
    queryKey: ["tamil-dubbed-list"],
    queryFn: () => dubmvApi.list({ matched: false, limit: 100 }),
    staleTime: 1000 * 60 * 2,
  });

  const popularItems = popularData?.items ?? [];
  const cachedItems = cachedData?.items ?? [];

  const cachedByTmdb = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const c of cachedItems) if (c.tmdbId) m.set(c.tmdbId, true);
    return m;
  }, [cachedItems]);

  const mergedPopular = useMemo(() =>
    popularItems.map(i => (!i.cached && cachedByTmdb.has(i.tmdbId) ? { ...i, cached: true } : i)),
    [popularItems, cachedByTmdb]
  );

  const filtered = useMemo(() =>
    search ? mergedPopular.filter(i => i.title.toLowerCase().includes(search.toLowerCase())) : mergedPopular,
    [search, mergedPopular]
  );

  const cached = useMemo(() => filtered.filter(i => i.cached), [filtered]);

  const cachedWithDuration = useMemo(() =>
    cached.filter(i => { const d = i.duration || ""; return !d || parseDuration(d) > 40; }),
    [cached]
  );

  const extraCached = useMemo(() =>
    cachedItems.filter(c => c.tmdbId && !mergedPopular.some(p => p.tmdbId === c.tmdbId)),
    [cachedItems, mergedPopular]
  );

  const extraCachedWithDuration = useMemo(() =>
    extraCached.filter(e => { const d = parseDuration(e.duration || ""); return d === 0 || d > 40; }),
    [extraCached]
  );

  const navigate = useNavigate();

  const displayCached = showAllCached ? cachedWithDuration : cachedWithDuration.slice(0, 24);
  const allCount = mergedPopular.length;
  const cachedCount = cachedWithDuration.length;
  const extraCount = extraCachedWithDuration.length;

  return (
    <div className="min-h-screen pt-20 pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">

        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  Tamil Dubbed
                </span>
              </h1>
              <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500">
                <span>{allCount} titles tracked</span>
                <span className="h-1 w-1 rounded-full bg-zinc-600" />
                <span className="text-emerald-400">{cachedCount} ready to play</span>
                {extraCount > 0 && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-zinc-600" />
                    <span>{extraCount} recently added</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search movies..."
                  className="w-48 rounded-xl border border-white/10 bg-white/5 pl-9 pr-4 py-2 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-violet-500/50 sm:w-64"
                />
              </div>
            </div>
          </div>
        </div>

        {popularError || cachedError ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-red-500">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <p className="text-lg font-semibold text-red-400">Failed to load titles</p>
            <p className="mt-1 text-sm text-zinc-500">The server may be unavailable. Run the seed script first.</p>
          </div>
        ) : popularLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-zinc-800" />
            ))}
          </div>
        ) : filtered.length === 0 && extraCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-zinc-700">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" />
            </svg>
            <p className="text-lg font-semibold">{search ? "No matching titles" : "No titles yet"}</p>
            <p className="mt-1 text-sm">
              {search ? "Try a different search term" : "Run `npm run dubmv:popular` to generate the list"}
            </p>
          </div>
        ) : (
          <>
            <section className="mb-14">
              <div className="mb-5 flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <h2 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                  Ready to Play
                </h2>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                  {cachedWithDuration.length}
                </span>
              </div>

              {cachedWithDuration.length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-zinc-700">
                    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <p className="text-sm text-zinc-500">No cached titles with duration &gt; 40 min yet.</p>
                  <p className="mt-1 text-xs text-zinc-500">Run <code className="text-violet-400">npm run dubmv:popular</code> to refresh</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {displayCached.map((item, i) => (
                      <MovieCard
                        key={`cached-${item.tmdbId}`}
                        item={item}
                        index={i}
                        onWatch={(it) => navigate(`/watch/dubmv/${it.fileId}`, { state: { entry: it } })}
                      />
                    ))}
                  </div>
                  {cachedWithDuration.length > 24 && (
                    <div className="mt-5 flex justify-center">
                      <Button
                        variant="secondary"
                        onClick={() => setShowAllCached(!showAllCached)}
                      >
                        {showAllCached ? "Show Less" : `Show All ${cachedWithDuration.length} Titles`}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}

        {extraCachedWithDuration.length > 0 && (
          <section className="mt-16">
            <div className="mb-5 flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]" />
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Recently Added</h2>
              <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-400">
                {extraCachedWithDuration.length}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {extraCachedWithDuration.slice(0, 24).map((entry, i) => (
                <MovieCard
                  key={entry.fileId}
                  item={entry}
                  index={i}
                  badgeText="New"
                  showBadge={false}
                  onWatch={(it) => navigate(`/watch/dubmv/${it.fileId}`, { state: { entry: it } })}
                />
              ))}
            </div>
            {extraCachedWithDuration.length > 24 && (
              <div className="mt-4 text-center">
                <span className="text-sm text-zinc-500">
                  +{extraCachedWithDuration.length - 24} more — run <code className="text-violet-400">npm run dubmv:seed</code> to expand
                </span>
              </div>
            )}
          </section>
        )}

        <div className="mt-16 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
          <p className="font-semibold text-white mb-2">Get more cached titles</p>
          <p>Run <code className="text-violet-400">npm run dubmv:seed</code> to crawl the default range (100000-100200).</p>
          <p className="mt-1">Or <code className="text-violet-400">npm run dubmv:crawl 80000 150000</code> for a wider scan.</p>
          <p className="mt-3 text-xs text-zinc-500">
            To refresh the popular list: <code className="text-violet-400">npm run dubmv:popular</code>
          </p>
        </div>
      </div>
    </div>
  );
}
