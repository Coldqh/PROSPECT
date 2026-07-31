import { readFileSync } from "node:fs";

const files = {
  positions: readFileSync("src/sports/football/team/positions.ts", "utf8"),
  ecosystemTypes: readFileSync("src/sports/football/ecosystem/types.ts", "utf8"),
  schema: readFileSync("src/storage/saves/schema.ts", "utf8"),
  migrations: readFileSync("src/storage/saves/migrations.ts", "utf8"),
  upgrade: readFileSync("src/sports/football/ecosystem/upgradeEcosystem.ts", "utf8"),
  match: readFileSync("src/sports/football/matches/simulateMatch.ts", "utf8"),
  playbook: readFileSync("src/sports/football/matches/playbook.ts", "utf8"),
  teamProfile: readFileSync("src/components/career/TeamProfileDashboard.tsx", "utf8"),
  ecosystem: readFileSync("src/sports/football/ecosystem/simulateEcosystem.ts", "utf8"),
};

const positions = ["QB", "RB", "WR", "TE", "OT", "OG", "C", "EDGE", "DT", "LB", "CB", "S", "K", "P"];
const failures = [];

for (const position of positions) {
  if (!files.positions.includes(`"${position}"`)) failures.push(`position catalog is missing ${position}`);
  if (!files.schema.includes(`${position}:`)) failures.push(`save schema is missing ${position}`);
}

const requiredTokens = [
  ["positions", "POSITION_ROOM_TARGETS"],
  ["positions", "POSITION_STARTER_TARGETS"],
  ["ecosystemTypes", "export const ECOSYSTEM_MODULE_VERSION = 14"],
  ["schema", "export const CURRENT_SCHEMA_VERSION = 35"],
  ["migrations", "migrateVersionTwentyFour"],
  ["upgrade", "upgradeFootballEcosystemV10"],
  ["upgrade", "normalizeFullRosterWorld"],
  ["match", "bindRosterToAssignments"],
  ["match", "specialistForSide"],
  ["match", "fieldGoalChance"],
  ["match", "puntNetYards"],
  ["teamProfile", "dynasty-roster-board"],
  ["teamProfile", 'label: "Атака"'],
  ["teamProfile", 'label: "Защита"'],
  ["teamProfile", 'label: "Спецкоманды"'],
];
for (const [file, token] of requiredTokens) {
  if (!files[file].includes(token)) failures.push(`${file}: missing ${token}`);
}

const legacyPlaybookPositions = /position:\s*["'](?:OL|DL)["']/g;
if (legacyPlaybookPositions.test(files.playbook)) failures.push("playbook still assigns legacy OL/DL positions");
const fivePositionLoop = /\[\s*["']QB["']\s*,\s*["']RB["']\s*,\s*["']WR["']\s*,\s*["']LB["']\s*,\s*["']CB["']\s*\]/g;
if (fivePositionLoop.test(files.ecosystem)) failures.push("ecosystem still contains a five-position world loop");

const hsTargets = { QB: 3, RB: 4, WR: 7, TE: 3, OT: 5, OG: 5, C: 2, EDGE: 4, DT: 4, LB: 6, CB: 7, S: 5, K: 1, P: 1 };
const collegeTargets = { QB: 4, RB: 6, WR: 9, TE: 5, OT: 6, OG: 6, C: 4, EDGE: 7, DT: 7, LB: 8, CB: 9, S: 7, K: 2, P: 2 };
const hsSize = Object.values(hsTargets).reduce((sum, value) => sum + value, 0);
const collegeSize = Object.values(collegeTargets).reduce((sum, value) => sum + value, 0);
if (hsSize !== 57) failures.push(`high-school roster target is ${hsSize}, expected 57`);
if (collegeSize !== 82) failures.push(`college roster target is ${collegeSize}, expected 82`);
for (const [position, count] of Object.entries(hsTargets)) {
  if (!files.positions.includes(`${position}: ${count}`)) failures.push(`high-school ${position} target must be ${count}`);
}
for (const [position, count] of Object.entries(collegeTargets)) {
  const collegeBlock = files.positions.slice(files.positions.indexOf("college:"));
  if (!collegeBlock.includes(`${position}: ${count}`)) failures.push(`college ${position} target must be ${count}`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Full roster architecture: OK (${positions.length} positions, ${hsSize} HS, ${collegeSize} college)`);
