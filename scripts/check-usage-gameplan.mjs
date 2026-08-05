import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const files = {
  types: read("src/sports/football/matches/types.ts"),
  usage: read("src/sports/football/matches/usage.ts"),
  playbook: read("src/sports/football/matches/playbook.ts"),
  engine: read("src/sports/football/matches/realTimeEngine.ts"),
  episodes: read("src/sports/football/matches/simulation/episodeBuilder.ts"),
  decision: read("src/sports/football/matches/simulation/matchDecision.ts"),
  dashboard: read("src/components/career/MatchDashboard.tsx"),
  schema: read("src/storage/saves/schema.ts"),
  migrations: read("src/storage/saves/migrations.ts"),
  proWeekly: read("src/sports/football/pro/league/weekly.ts"),
};
const required = [
  ["types", "MatchUsagePlan"],
  ["types", "missedOpenWindows"],
  ["usage", "buildMatchUsagePlan"],
  ["usage", "receiverPriorityMap"],
  ["usage", "usagePriorityForSnap"],
  ["playbook", "featuredRole"],
  ["engine", "behindCoverage"],
  ["engine", "overTopRisk"],
  ["engine", "heroOpenWindowTargeted"],
  ["episodes", "receiverPriorities"],
  ["decision", "usageDeltaForSnap"],
  ["dashboard", "OPEN TGT"],
  ["dashboard", "MISSED"],
  ["schema", "CURRENT_SCHEMA_VERSION = 35"],
  ["migrations", "migrateVersionThirtyTwo"],
  ["proWeekly", "usage: match.finalResult.usage ?? match.usageStats"],
  ["schema", "usage: matchUsageStatLineSchema.optional()"],
];
const failures = required
  .filter(([file, token]) => !files[file].includes(token))
  .map(([file, token]) => `${file}: missing ${token}`);
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Usage and gameplan architecture: ${required.length} checks passed.`);
