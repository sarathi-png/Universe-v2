# Decisions Log

| Date | Decision | Why |
|------|----------|-----|
| 2026-08-07 | Use vidsrc.su as sole live fallback provider | All other tested embeds (embedder.net, multiembed.mov, autoembed.cc, embed.su, 2embed.org, vidsrc.rip, smv.su, vidlink.pro, ezvid, etc.) dead/blocked |
| 2026-08-07 | Fallback sources appended to PROVIDERS, existing logic untouched | User explicitly required no changes to existing provider logic/Player |
| 2026-08-07 | Mobile app: React Native + Expo, Android only, streaming only, shared types + API layer, core streaming MVP | User choices; MovieBox 3.2 APK as UI reference, FMHY as fallback scraper source |
| 2026-08-08 | SSRF guard rejects private/loopback/link-local IPs after DNS resolution | Prevents server-side request forgery via `/api/language/transcode` |
| 2026-08-08 | dubmv proxy: numeric fileId validation + HTML escaping | Prevents reflected XSS in proxy page |
| 2026-08-08 | `CORS_ORIGINS` env var override for server CORS | Needed for future mobile app origin (hosted URL) without redeploys |
| 2026-08-08 | Auto-fallback moved from one-shot timeout to 5s interval with stall detection | Fixes permanently-disabled fallback after manual source switch; catches mid-playback stalls |