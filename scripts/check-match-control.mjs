import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const checks = [
  ["src/sports/football/matches/types.ts", 'export type MatchHeroControlMode = "assisted" | "manual" | "spectator"'],
  ["src/sports/football/matches/realTimeEngine.ts", "export function liveHeroControlActive"],
  ["src/sports/football/matches/realTimeEngine.ts", "mode === \"spectator\""],
  ["src/sports/football/matches/realTimeEngine.ts", "0.8,"],
  ["src/sports/football/matches/realTimeEngine.ts", "21,"],
  ["src/components/career/RealTimeMatchField.tsx", "live-snap-result-dialog"],
  ["src/components/career/RealTimeMatchField.tsx", "Управление включится после владения мячом"],
  ["src/components/career/MatchDashboard.tsx", "match-control-mode"],
  ["src/storage/saves/schema.ts", 'heroControlMode: z.enum(["assisted", "manual", "spectator"]).default("assisted")'],
];
for (const [path, token] of checks) {
  if (!read(path).includes(token)) throw new Error(`${path}: missing ${token}`);
}
console.log(`Match control architecture: ${checks.length} checks passed.`);
