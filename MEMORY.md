# Session Log — 2026-08-10

## What Was Done (afternoon follow-up)
- **Reverted embed sandbox**: vidsrc.su's ad SDK (Google IMA) refuses sandboxed frames ("This content can't be embedded in a sandboxed frame") → sandbox broke playback. Removed `sandbox` + `referrerPolicy` from `Player.tsx` iframe.
- **Fixed beforeunload blocker**: old logic (reading `e.target.outerHTML` + hash trick) was dead/ineffective. Now `preventDefault() + returnValue=""` → Chrome/Firefox show a cancelable "Leave site?" prompt when an embed tries to redirect the top window (gated on user activation from the ad click).
- **Source labels**: Watch.tsx mirror chips now read `Mirror · may show ads`; Clean sources keep green badge. Clean sources remain sorted first server-side.
- **Verified**: typecheck + build green.

## Next Steps
- Commit/push, confirm Render deploy, re-test a Mirror source on `/watch` (playback works; ad redirects are cancelable).

---

# Session Log — 2026-08-10 (earlier)

## What Was Done
- **Mobile "Watch Now" fix (Tamil Dubbed)**: `PopularCard`/`ExtraCachedCard` in `TamilDubbed.tsx` used `group-hover` reveal for the button — invisible on touch devices (Tailwind v4 gates hover behind `@media (hover:hover)`). Now visible by default on mobile (`md:translate-y-full md:group-hover:translate-y-0`), title bumped to `bottom-14 md:bottom-1`.
- **Ad redirect fix (embeds)**: `Player.tsx` embed iframe now has `sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"` + `referrerPolicy="no-referrer"`. Omitting `allow-top-navigation`/`allow-popups` makes the browser block ad redirects/popups from vidsrc.su etc. while keeping inline playback. Existing `beforeunload` blocker kept as defense-in-depth.
- **Verified**: typecheck + build green.

## Next Steps
- Deploy + manually verify: `/browse/tamil-dubbed` on mobile (button visible), Mirror source on `/watch` (no ad redirect, playback works).

---

# Session Log — 2026-08-08

## What Was Done
- **Low/Info audit pass** (43 findings reconstructed via 2 parallel review agents): 41 files changed, committed as `f7b0658`, pushed to main → Render deploying.
- **Functional bug fixed**: Watchlist page rendered `watchlist` instead of `displayItems` — search filter, sort, and History tab were all broken.
- **A11y**: dialog semantics (role/aria-modal/aria-label) in CardModal, aria-labels on close/scroll/mic buttons, seek bar is now a real slider (role, aria-valuenow, arrow-key seeking), Player wrapped in ErrorBoundary with "try next source" fallback.
- **Dead code removed**: `src/api/language.ts`, `src/services/languageManager.ts`, `src/utils/dominantColor.ts`, `test_tsa.ts`, `scrapeBest`, `providerCount`, `rawGet`, `useByGenre`, `useParallax`, `setQuality`/`qualityLevels`, 8 unused CSS utilities, `audioTracks` prop, `Play` re-export, `index` prop on MediaCard.
- **Server hardening**: param validation on all TMDB routes (400s), 15s timeouts on dubmv proxy fetches, ffprobe 45s timeout, `AbortSignal.timeout` on TMDB util, regex-injection fix in languageScanner, security headers middleware, dependency-free rate limiter (scan/media/scrape/tamilmv), JSON 404 for unknown /api paths, keep-warm TLS verification + timeout.
- **index.html**: favicon.svg + og:description/og:image/twitter tags.
- **Verified**: typecheck + build pass; live smoke test (health ok, /api 404, invalid param 400).

## Key Learnings
- `req.params` values are typed `string | string[]` in this Express types version — coerce with a `paramStr` helper.
- Express 4 async handlers need explicit try/catch or the client hangs.
- PowerShell `Start-Process` needs `-WorkingDirectory`; git stderr shows as error text on successful pushes.

## Next Steps
- Confirm Render deploy green, spot-check site.
- Begin `novastream-mobile` scaffold (Expo SDK 55, streaming-only MVP) per approved plan.
