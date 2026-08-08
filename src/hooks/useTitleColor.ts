import { useMemo } from "react";

// pseudo-ambient color derived from id for consistent glow per item
const PALETTES = [
  ["#7c3aed", "#2563eb"],
  ["#db2777", "#7c3aed"],
  ["#0891b2", "#2563eb"],
  ["#f59e0b", "#db2777"],
  ["#10b981", "#0891b2"],
  ["#ef4444", "#f59e0b"],
  ["#6366f1", "#06b6d4"],
] as const;

export function useAmbientColor(seed?: number | string): [string, string] {
  return useMemo(() => {
    const n = typeof seed === "number" ? seed : (seed || "").length;
    const p = PALETTES[Math.abs(n) % PALETTES.length];
    return [p[0], p[1]];
  }, [seed]);
}