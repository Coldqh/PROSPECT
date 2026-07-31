import type { CSSProperties } from "react";

export interface TeamBrandProperties extends CSSProperties {
  "--team-hue": string;
  "--team-primary": string;
  "--team-secondary": string;
  "--team-ink": string;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function teamBrandStyle(seed: string, fallbackHue = 354): TeamBrandProperties {
  const hash = hashSeed(seed || "prospect");
  const hue = Number.isFinite(hash) ? hash % 360 : fallbackHue;
  const saturation = 58 + (hash % 18);
  const lightness = 42 + (hash % 10);
  return {
    "--team-hue": String(hue),
    "--team-primary": `hsl(${hue} ${saturation}% ${lightness}%)`,
    "--team-secondary": `hsl(${(hue + 28) % 360} ${Math.max(42, saturation - 10)}% ${Math.min(68, lightness + 18)}%)`,
    "--team-ink": lightness >= 52 ? "#08090b" : "#ffffff",
  };
}

export function teamMark(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? "P"}${parts[1]?.[0] ?? "R"}`.toUpperCase();
  return name.slice(0, 3).toUpperCase();
}
