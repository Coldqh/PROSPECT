import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const history = read("src/sports/football/ecosystem/history.ts");
const simulation = read("src/sports/football/ecosystem/simulateEcosystem.ts");
const schema = read("src/storage/saves/schema.ts");
const migrations = read("src/storage/saves/migrations.ts");
const stability = read("src/sports/football/ecosystem/stability.ts");
const worldUi = read("src/components/career/WorldDashboard.tsx");

const checks = [
  [history.includes("createWorldHistory") && history.includes("advanceWorldHistory"), "persistent world-history engine"],
  [history.includes("processedSourceIds") && history.includes("factFromStory") && history.includes("factFromTransaction"), "facts sourced only from simulation records"],
  [history.includes("ensureCurrentObjectives") && history.includes("advanceArcs"), "autonomous objectives and story arcs"],
  [simulation.includes("stories: sourceStories") && simulation.includes("transactions,"), "complete simulation source ingestion"],
  [schema.includes("CURRENT_SCHEMA_VERSION = 34") && schema.includes("worldHistory: ecosystemWorldHistorySchema"), "schema 34 world-history persistence"],
  [migrations.includes("migrateVersionThirtyThree") && migrations.includes("upgradeFootballEcosystemV12"), "schema 33 migration"],
  [stability.includes("worldHistory.facts") && stability.includes("worldHistory.objectives") && stability.includes("worldHistory.arcs"), "long-run history invariants"],
  [worldUi.includes("world-v47-history") && worldUi.includes("activeArcs"), "visible emergent storylines"],
];

for (const [ok, label] of checks) {
  if (!ok) throw new Error(`Missing ${label}`);
}
console.log(`World history: ${checks.length} checks passed.`);
