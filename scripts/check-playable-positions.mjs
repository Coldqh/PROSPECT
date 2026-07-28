import { readFileSync } from "node:fs";

const positions = ["QB", "RB", "WR", "TE", "OT", "OG", "C", "EDGE", "DT", "LB", "CB", "S", "K", "P"];
const files = {
  types: readFileSync("src/sports/football/career/types.ts", "utf8"),
  catalog: readFileSync("src/sports/football/career/catalog.ts", "utf8"),
  creation: readFileSync("src/sports/football/career/createFootballCareer.ts", "utf8"),
  college: readFileSync("src/sports/football/college/transition.ts", "utf8"),
  tactics: readFileSync("src/sports/football/ecosystem/tactics.ts", "utf8"),
  recruiting: readFileSync("src/sports/football/recruiting/createRecruitingState.ts", "utf8"),
  training: readFileSync("src/sports/football/training/catalog.ts", "utf8"),
  matchTypes: readFileSync("src/sports/football/matches/types.ts", "utf8"),
  matchState: readFileSync("src/sports/football/matches/createMatchState.ts", "utf8"),
  playbook: readFileSync("src/sports/football/matches/playbook.ts", "utf8"),
  simulation: readFileSync("src/sports/football/matches/simulateMatch.ts", "utf8"),
  season: readFileSync("src/components/career/SeasonDashboard.tsx", "utf8"),
  matchUi: readFileSync("src/components/career/MatchDashboard.tsx", "utf8"),
  profile: readFileSync("src/components/career/PlayerProfileDashboard.tsx", "utf8"),
  professionalState: readFileSync("src/sports/football/pro/createProfessionalState.ts", "utf8"),
  professional: readFileSync("src/sports/football/pro/draft.ts", "utf8"),
  schema: readFileSync("src/storage/saves/schema.ts", "utf8"),
  migrations: readFileSync("src/storage/saves/migrations.ts", "utf8"),
  tests: readFileSync("src/sports/football/matches/simulateMatch.test.ts", "utf8"),
};

const failures = [];
for (const position of positions) {
  if (!files.types.includes(`"${position}"`)) failures.push(`career type is missing ${position}`);
  if (!files.catalog.includes(`id: "${position}"`)) failures.push(`position descriptor is missing ${position}`);
  const archetypeCount = (files.catalog.match(new RegExp(`position: "${position}"`, "g")) ?? []).length;
  if (archetypeCount !== 3) failures.push(`career catalog must contain three ${position} archetypes, found ${archetypeCount}`);
  if (!files.tactics.includes(`${position}: {`)) failures.push(`tactical archetypes are missing ${position}`);
  if (!files.recruiting.includes(`${position}: [`)) failures.push(`recruiting schemes are missing ${position}`);
  if (!files.training.includes(`${position}:`)) failures.push(`training catalog is missing ${position}`);
  if (!files.simulation.includes(`${position}:`)) failures.push(`match spotlight is missing ${position}`);
  if (!files.tests.includes(`${position}: { archetypeId:`)) failures.push(`playable-position test setup is missing ${position}`);
}

const required = [
  ["types", "CAREER_FOOTBALL_POSITIONS"],
  ["creation", "CAREER_FOOTBALL_POSITIONS"],
  ["college", '"OT", "OG", "C", "EDGE", "DT"'],
  ["professionalState", "CAREER_FOOTBALL_POSITIONS"],
  ["matchTypes", 'export type MatchUnit = "offense" | "defense" | "special"'],
  ["matchState", 'position === "K" || position === "P"'],
  ["playbook", "buildSpecialTeamsAssignments"],
  ["playbook", "ensureHeroPosition"],
  ["simulation", "simulateSpecialTeamsSnap"],
  ["simulation", "fieldGoalsAttempted"],
  ["simulation", "sacksAllowed"],
  ["season", 'case "K"'],
  ["season", 'case "P"'],
  ["matchUi", 'case "OT"'],
  ["matchUi", 'case "EDGE"'],
  ["profile", 'case "S"'],
  ["professional", "CAREER_FOOTBALL_POSITIONS"],
  ["schema", "export const CURRENT_SCHEMA_VERSION = 26"],
  ["schema", 'heroUnit: z.enum(["offense", "defense", "special"])'],
  ["migrations", "migrateVersionTwentyFive"],
  ["tests", "CAREER_FOOTBALL_POSITIONS"],
];
for (const [file, token] of required) if (!files[file].includes(token)) failures.push(`${file}: missing ${token}`);

const fiveOnly = /\[\s*["']QB["']\s*,\s*["']RB["']\s*,\s*["']WR["']\s*,\s*["']LB["']\s*,\s*["']CB["']\s*\]/;
for (const [name, source] of Object.entries(files)) if (fiveOnly.test(source)) failures.push(`${name}: contains legacy five-position list`);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Playable career architecture: OK (${positions.length} positions)`);
