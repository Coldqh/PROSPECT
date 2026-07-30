import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const files = {
  ecosystemTypes: read("src/sports/football/ecosystem/types.ts"),
  ecosystemCoaching: read("src/sports/football/ecosystem/coaching.ts"),
  tactics: read("src/sports/football/ecosystem/tactics.ts"),
  playbook: read("src/sports/football/matches/playbook.ts"),
  simulation: read("src/sports/football/matches/simulateMatch.ts"),
  proTypes: read("src/sports/football/pro/types.ts"),
  proCoaching: read("src/sports/football/pro/coaching.ts"),
  proLeague: read("src/sports/football/pro/league.ts"),
  schema: read("src/storage/saves/schema.ts"),
  migrations: read("src/storage/saves/migrations.ts"),
  teams: read("src/components/career/TeamProfileDashboard.tsx"),
  leagues: read("src/components/career/LeagueDirectoryDashboard.tsx"),
};
const required = [
  ["ecosystemTypes", '"offensive-coordinator"'],
  ["ecosystemTypes", "staffFingerprint"],
  ["ecosystemCoaching", "completeCoachingStaff"],
  ["ecosystemCoaching", "staffRating"],
  ["tactics", "runRate"],
  ["tactics", "adaptation"],
  ["playbook", "PlayCallStrategy"],
  ["playbook", "recentOffense"],
  ["simulation", "tacticalProfileForSide"],
  ["proTypes", "ProfessionalCoach"],
  ["proTypes", "ProfessionalTacticalIdentity"],
  ["proCoaching", "advanceProfessionalCoaching"],
  ["proCoaching", "professionalTacticalModifier"],
  ["proCoaching", "professionalSchemeFit"],
  ["proLeague", "player.schemeFit * 0.12"],
  ["proLeague", "professionalTacticalModifier(home, away)"],
  ["schema", "CURRENT_SCHEMA_VERSION = 32"],
  ["migrations", "migrateVersionThirtyOne"],
  ["teams", "worldTeam.tactical.adaptation"],
  ["leagues", "team.staff ?? []"],
];
const failures = required.filter(([file, token]) => !files[file].includes(token)).map(([file, token]) => `${file}: missing ${token}`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Coaching and tactical architecture: ${required.length} checks passed.`);
