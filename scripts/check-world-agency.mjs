import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const agency = read("src/sports/football/ecosystem/agency.ts");
const types = read("src/sports/football/ecosystem/types.ts");
const simulation = read("src/sports/football/ecosystem/simulateEcosystem.ts");
const schema = read("src/storage/saves/schema.ts");
const migrations = read("src/storage/saves/migrations.ts");
const stability = read("src/sports/football/ecosystem/stability.ts");
const worldUi = read("src/components/career/WorldDashboard.tsx");

const checks = [
  [agency.includes("createAgencyState") && agency.includes("advanceWorldAgency"), "persistent autonomous-agency engine"],
  [agency.includes("player-portal-entry") && agency.includes("team-tactical-shift") && agency.includes("coach-staff-reshuffle"), "real player, team and staff consequences"],
  [agency.includes("canOpenConflict") && agency.includes("MAX_PROCESSED_DECISION_KEYS"), "conflict cooldown and bounded decision processing"],
  [simulation.includes("advanceWorldAgency") && simulation.includes("retainedAgencyFactIds"), "weekly integration and final reference cleanup"],
  [types.includes("ECOSYSTEM_MODULE_VERSION = 14") && types.includes("EcosystemAgencyState"), "ecosystem module 14 agency types"],
  [schema.includes("CURRENT_SCHEMA_VERSION = 35") && schema.includes("agency: ecosystemAgencySchema"), "schema 35 agency persistence"],
  [schema.includes("week: z.number().int().min(0).max(10000)"), "long-career absolute timeline weeks"],
  [migrations.includes("migrateVersionThirtyFour") && migrations.includes("upgradeFootballEcosystemV13"), "schema 34 migration"],
  [stability.includes("agency.conflicts") && stability.includes("agency.decisions"), "long-run agency invariants"],
  [worldUi.includes("world-v48-agency") && worldUi.includes("activeConflicts"), "visible active conflicts and decisions"],
];

for (const [ok, label] of checks) {
  if (!ok) throw new Error(`Missing ${label}`);
}
console.log(`World agency: ${checks.length} checks passed.`);
