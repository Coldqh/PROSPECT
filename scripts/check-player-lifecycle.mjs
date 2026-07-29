import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const required = [
  ["src/sports/football/ecosystem/types.ts", "export interface EcosystemPlayerCareerRecord"],
  ["src/sports/football/ecosystem/types.ts", "careerRegistry: EcosystemCareerRegistry"],
  ["src/sports/football/ecosystem/lifecycle.ts", "export function syncCareerRegistry"],
  ["src/sports/football/ecosystem/lifecycle.ts", "export function registerProfessionalDraftClass"],
  ["src/sports/football/ecosystem/lifecycle.ts", "export function syncProfessionalCareerRegistry"],
  ["src/sports/football/pro/types.ts", "sourcePlayerId?: string"],
  ["src/sports/football/pro/draft.ts", "function worldProspect"],
  ["src/sports/football/pro/draft.ts", "sourcePlayerId: player.id"],
  ["src/sports/football/pro/league.ts", "function runLifecycleRookieDraft"],
  ["src/sports/football/pro/league.ts", "function advanceBackgroundWorld"],
  ["src/components/career/WorldDashboard.tsx", 'setInternalView("careers")'],
  ["src/storage/saves/schema.ts", "CURRENT_SCHEMA_VERSION = 31"],
];
for (const [path, token] of required) {
  if (!read(path).includes(token)) throw new Error(`${path}: missing ${token}`);
}
const forbidden = [
  ["src/sports/football/pro/draft.ts", "generatedProspect"],
  ["src/sports/football/pro/league.ts", "generateRookieFreeAgents"],
];
for (const [path, token] of forbidden) {
  if (read(path).includes(token)) throw new Error(`${path}: obsolete parallel player source ${token}`);
}
console.log(`Persistent player lifecycle: ${required.length + forbidden.length} checks passed.`);
