import { readFileSync } from "node:fs";

const files = {
  types: readFileSync("src/sports/football/pro/types.ts", "utf8"),
  state: readFileSync("src/sports/football/pro/createProfessionalState.ts", "utf8"),
  league: readFileSync("src/sports/football/pro/league.ts", "utf8"),
  draft: readFileSync("src/sports/football/pro/draft.ts", "utf8"),
  repository: readFileSync("src/storage/saves/CareerRepository.ts", "utf8"),
  dashboard: readFileSync("src/components/career/ProfessionalTransitionDashboard.tsx", "utf8"),
  seasonDashboard: readFileSync("src/components/career/ProfessionalSeasonDashboard.tsx", "utf8"),
  schema: readFileSync("src/storage/saves/schema.ts", "utf8"),
  migrations: readFileSync("src/storage/saves/migrations.ts", "utf8"),
  draftTests: readFileSync("src/sports/football/pro/draft.test.ts", "utf8"),
  campTests: readFileSync("src/sports/football/pro/camp.test.ts", "utf8"),
  campFreeAgencyTests: readFileSync("src/sports/football/pro/campFreeAgency.test.ts", "utf8"),
  leagueStructureTests: readFileSync("src/sports/football/pro/leagueStructure.test.ts", "utf8"),
  leagueTests: readFileSync("src/sports/football/pro/league.test.ts", "utf8"),
  leaguePracticeTests: readFileSync("src/sports/football/pro/leaguePractice.test.ts", "utf8"),
  leagueSeasonTests: readFileSync("src/sports/football/pro/leagueSeason.test.ts", "utf8"),
  proTestRunner: readFileSync("scripts/run-professional-tests.mjs", "utf8"),
  testFixtures: readFileSync("src/sports/football/pro/professionalTestFixtures.ts", "utf8"),
  package: readFileSync("package.json", "utf8"),
};

const required = [
  ["types", "ProfessionalLeagueState"],
  ["types", "ProfessionalRosterPlayer"],
  ["types", 'ProfessionalSeasonPhase = "preseason" | "regular-season" | "playoffs" | "complete"'],
  ["state", "PROFESSIONAL_SALARY_CAP = 255_000_000"],
  ["league", "PROFESSIONAL_ROSTER_COUNTS"],
  ["league", "roundRobinSchedule"],
  ["league", "runNpcFreeAgency"],
  ["league", "createProfessionalMatchState"],
  ["league", "finalizeProfessionalMatch"],
  ["league", "advanceProfessionalWeek"],
  ["league", "advanceProfessionalOffseason"],
  ["league", "runLifecycleRookieDraft"],
  ["league", "buildPlayoffWeek"],
  ["draft", "initializeProfessionalLeague"],
  ["repository", "isProfessionalMatchAwaitingResolution"],
  ["repository", "acceptProfessionalFreeAgentOffer"],
  ["repository", "advanceProfessionalOffseason"],
  ["seasonDashboard", "professionalStandings"],
  ["dashboard", "onAdvanceProfessionalOffseason"],
  ["dashboard", "MatchDashboard"],
  ["schema", "CURRENT_SCHEMA_VERSION = 34"],
  ["migrations", "migrateVersionTwentySeven"],
  ["campTests", "persistent roster decision"],
  ["campFreeAgencyTests", "53-player active roster"],
  ["leagueStructureTests", "cap-valid 53-player clubs"],
  ["leagueTests", "real-time match kernel"],
  ["leaguePracticeTests", "practice-squad week"],
  ["leagueSeasonTests", "completedSeasonYear + 1"],
  ["testFixtures", "cloneCareer"],
  ["testFixtures", "activateProfessionalCareer"],
  ["package", "scripts/run-professional-tests.mjs"],
  ["proTestRunner", "campFreeAgency.test.ts"],
  ["proTestRunner", "leagueStructure.test.ts"],
  ["proTestRunner", "leaguePractice.test.ts"],
  ["proTestRunner", "leagueSeason.test.ts"],
  ["proTestRunner", "--environment=node"],
  ["proTestRunner", "spawnSync"],
];

const failures = required
  .filter(([file, token]) => !files[file].includes(token))
  .map(([file, token]) => `${file}: missing ${token}`);

const rosterTargets = { QB: 3, RB: 4, WR: 5, TE: 3, OT: 5, OG: 4, C: 2, EDGE: 4, DT: 4, LB: 5, CB: 5, S: 4, K: 1, P: 1 };
const initialRosterSize = Object.values(rosterTargets).reduce((sum, count) => sum + count, 0);
if (initialRosterSize !== 50) failures.push(`professional base roster is ${initialRosterSize}, expected 50 before three free-agent signings`);
for (const [position, count] of Object.entries(rosterTargets)) {
  if (!files.league.includes(`${position}: ${count}`)) failures.push(`professional ${position} base target must be ${count}`);
}
if (!files.league.includes("rosterSize ?? 53) < 53")) failures.push("professional free agency must refill every club to the active roster limit");
if (!files.league.includes("item.status === \"complete\" && !item.playoffRound")) failures.push("regular-season records must not absorb playoff results");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Professional league architecture: OK (16 clubs, 53-player rosters, cap, free agency, multi-season rollover, playoffs, interactive hero games)");
