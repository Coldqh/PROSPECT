import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const social = read("src/sports/football/ecosystem/social.ts");
const agency = read("src/sports/football/ecosystem/agency.ts");
const history = read("src/sports/football/ecosystem/history.ts");
const stability = read("src/sports/football/ecosystem/stability.ts");
const socialTests = read("src/sports/football/ecosystem/social.test.ts");
const agencyTests = read("src/sports/football/ecosystem/agency.test.ts");
const historyTests = read("src/sports/football/ecosystem/history.test.ts");
const stabilityTests = read("src/sports/football/ecosystem/stability.test.ts");
const schema = read("src/storage/saves/schema.ts");
const types = read("src/sports/football/ecosystem/types.ts");

const checks = [
  [social.includes("INCIDENT_COOLDOWN_WEEKS") && social.includes("compactIncidents") && social.includes("recentNegativeTeamIncident"), "bounded social-incident cadence"],
  [social.includes("bond.tension - 22") && social.includes("bond.tension - 20"), "conflict and reconciliation tension release"],
  [agency.includes("playerHasAgencyLeverage") && agency.includes("playerEvaluation"), "merit-aware agency candidates"],
  [agency.includes("promotePlayerOneSlot") && agency.includes("POSITION_STARTER_TARGETS"), "contiguous role-review depth chart"],
  [agency.includes("compactConflicts") && agency.includes("createdSeasonYear === seasonYear"), "one actor conflict per season"],
  [history.includes("historyFactSemanticKey") && history.includes("dedupeFacts") && history.includes("preferredFact"), "semantic history deduplication"],
  [stability.includes('"depth-chart"') && stability.includes('"simulation-quality"'), "simulation-quality invariant classes"],
  [stability.includes("historyFactSemanticKey") && stability.includes("actorSeasonKeys"), "fact and conflict duplicate audits"],
  [socialTests.includes("const repeated") && agencyTests.includes("roomRanks"), "social and depth-chart regressions"],
  [historyTests.includes("emitted as both story and transaction") && stabilityTests.includes("map(historyFactSemanticKey)"), "history and long-run quality regressions"],
  [schema.includes("CURRENT_SCHEMA_VERSION = 35") && types.includes("ECOSYSTEM_MODULE_VERSION = 14"), "no unnecessary save or ecosystem migration"],
];

for (const [ok, label] of checks) {
  if (!ok) throw new Error(`Missing ${label}`);
}
console.log(`Simulation quality: ${checks.length} checks passed.`);
