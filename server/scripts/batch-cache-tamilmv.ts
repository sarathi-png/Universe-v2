import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { searchTamilmv } from "../services/tamilmvScraper.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../data");

interface SeedEntry {
  tmdbId: number;
  title: string;
  year: number;
  type: "movie" | "tv";
  popularity: number;
}

function loadSeed(): SeedEntry[] {
  const p = resolve(DATA_DIR, "popular-seed.json");
  return JSON.parse(readFileSync(p, "utf-8"));
}

async function main() {
  const seed = loadSeed();
  console.log(`[batch] Starting cache for ${seed.length} entries`);

  let cached = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < seed.length; i++) {
    const item = seed[i];
    process.stdout.write(`[${i + 1}/${seed.length}] ${item.title} (${item.year})... `);

    const result = await searchTamilmv(item.tmdbId, item.type);
    if (!result) {
      failed++;
      console.log(`FAIL`);
    } else {
      cached++;
      console.log(`OK — ${result.torrents.length} torrents`);
    }

    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
  }

  console.log(`\nDone. Cached: ${cached}, Failed: ${failed}, Skipped: ${skipped}`);
  process.exit(0);
}

main().catch(console.error);
