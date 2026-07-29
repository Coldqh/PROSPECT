import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const required = [
  ["src/sports/football/matches/realTimeEngine.ts", "function hasManualMovementInput"],
  ["src/sports/football/matches/realTimeEngine.ts", "export function liveHeroControlActive(input"],
  ["src/sports/football/matches/realTimeEngine.ts", "heroHasManualControl(player, input)"],
  ["src/components/career/RealTimeMatchField.tsx", "is-manual-override"],
  ["src/components/career/RealTimeMatchField.tsx", "АВТОМАРШРУТ"],
  ["src/components/career/RealTimeMatchField.tsx", "live-snap-result-dialog"],
  ["src/components/career/MatchDashboard.tsx", "Автопилот + мгновенный перехват"],
];
for (const [path, token] of required) {
  if (!read(path).includes(token)) throw new Error(`${path}: missing ${token}`);
}
const forbidden = [
  ["src/sports/football/matches/types.ts", "MatchHeroControlMode"],
  ["src/storage/saves/schema.ts", "heroControlMode"],
  ["src/components/career/MatchDashboard.tsx", "match-control-mode"],
];
for (const [path, token] of forbidden) {
  if (read(path).includes(token)) throw new Error(`${path}: obsolete token ${token}`);
}
console.log(`Seamless match control: ${required.length + forbidden.length} checks passed.`);
