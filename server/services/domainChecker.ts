import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "../config/domains.json");

interface DomainEntry {
  host: string;
  baseUrl: string;
  lastChecked: string | null;
  lastVerified: string | null;
}

interface DomainsConfig {
  yts: DomainEntry;
  tamilmv: DomainEntry;
}

const YTS_ALTERNATIVES = [
  "yts.gg", "yts.mx", "yts.ag", "yts.do", "yts.rs", "yts.lt",
  "yts.ax", "yts.vg",
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function loadConfig(): DomainsConfig {
  if (!existsSync(CONFIG_PATH)) {
    const dir = resolve(__dirname, "../config");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const defaults: DomainsConfig = {
      yts: { host: "yts.gg", baseUrl: "https://yts.gg", lastChecked: null, lastVerified: null },
      tamilmv: { host: "www.1tamilmv.promo", baseUrl: "https://www.1tamilmv.promo", lastChecked: null, lastVerified: null },
    };
    writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2), "utf-8");
    return defaults;
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as DomainsConfig;
}

function saveConfig(cfg: DomainsConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

async function checkYTS(host: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const url = `https://${host}/api/v2/list_movies.json?query_term=avengers&limit=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: signal || AbortSignal.timeout(8000),
    });
    if (r.status !== 200) return false;
    const json = await r.json() as any;
    return json?.status === "ok" && json?.["@meta"]?.server_time != null;
  } catch {
    return false;
  }
}

async function check1TamilMV(host: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const url = `https://${host}/search/api/search.php?q=avengers&page=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Referer: `https://${host}/search/` },
      signal: signal || AbortSignal.timeout(8000),
    });
    if (r.status !== 200) return false;
    const json = await r.json() as any;
    return json?.results && Array.isArray(json.results) && json.results.length > 0;
  } catch {
    return false;
  }
}

async function discoverNewTamilmvDomain(fallbackHost: string): Promise<string | null> {
  const tryHosts = ["www.1tamilmv.promo", "www.1tamilmv.reisen", "www.1tamilmv.durban", fallbackHost];
  const seen = new Set<string>();

  for (const host of tryHosts) {
    if (seen.has(host)) continue;
    seen.add(host);
    try {
      const r = await fetch(`https://${host}/index.php?/forums/topic/181291/`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(10000),
      });
      const html = await r.text();
      const match = html.match(/WWW\.([A-Z0-9.-]+)\.[A-Z]{2,}/i);
      if (match) {
        const found = match[0].toLowerCase().trim();
        if (found && !seen.has(found)) {
          const clean = found.replace(/^www\./i, "");
          return clean;
        }
      }
    } catch {}
  }
  return null;
}

export async function checkAllDomains(): Promise<DomainsConfig> {
  const cfg = loadConfig();
  const now = new Date().toISOString();
  let changed = false;

  // Check YTS
  let ytsOk = await checkYTS(cfg.yts.host);
  if (!ytsOk) {
    console.log(`[DomainChecker] YTS ${cfg.yts.host} failed — probing alternatives...`);
    for (const alt of YTS_ALTERNATIVES) {
      if (alt === cfg.yts.host) continue;
      ytsOk = await checkYTS(alt);
      if (ytsOk) {
        console.log(`[DomainChecker] YTS found new working domain: ${alt}`);
        cfg.yts.host = alt;
        cfg.yts.baseUrl = `https://${alt}`;
        changed = true;
        break;
      }
    }
  }
  cfg.yts.lastChecked = now;
  if (ytsOk) cfg.yts.lastVerified = now;

  // Check 1TamilMV
  let tmvOk = await check1TamilMV(cfg.tamilmv.host);
  if (!tmvOk) {
    console.log(`[DomainChecker] 1TamilMV ${cfg.tamilmv.host} failed — probing alternatives...`);
    const discovered = await discoverNewTamilmvDomain(cfg.tamilmv.host);
    if (discovered && discovered !== cfg.tamilmv.host) {
      const tested = await check1TamilMV(discovered);
      if (tested) {
        console.log(`[DomainChecker] 1TamilMV found new working domain: ${discovered}`);
        cfg.tamilmv.host = discovered;
        cfg.tamilmv.baseUrl = `https://${discovered}`;
        changed = true;
        tmvOk = true;
      }
    }
  }
  cfg.tamilmv.lastChecked = now;
  if (tmvOk) cfg.tamilmv.lastVerified = now;

  if (changed) saveConfig(cfg);

  return cfg;
}

export function getDomains(): DomainsConfig {
  return loadConfig();
}

export function scheduleDailyCheck(): void {
  // Run once on startup, then every 24h
  checkAllDomains().catch(() => {});

  setInterval(() => {
    checkAllDomains().catch(() => {});
  }, 24 * 60 * 60 * 1000);
}
