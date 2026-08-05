import { readFileSync } from "node:fs";

const files = {
  types: readFileSync("src/sports/football/matches/types.ts", "utf8"),
  forecast: readFileSync("src/sports/football/matches/decisionForecast.ts", "utf8"),
  simulation: readFileSync("src/sports/football/matches/simulateMatch.ts", "utf8"),
  engine: readFileSync("src/sports/football/matches/realTimeEngine.ts", "utf8"),
  field: readFileSync("src/components/career/RealTimeMatchField.tsx", "utf8"),
  dashboard: readFileSync("src/components/career/MatchDashboard.tsx", "utf8"),
  today: readFileSync("src/components/career/TodayDashboard.tsx", "utf8"),
  commands: readFileSync("src/application/career/CareerCommandService.ts", "utf8"),
  schema: readFileSync("src/storage/saves/schema.ts", "utf8"),
  migrations: readFileSync("src/storage/saves/migrations.ts", "utf8"),
  tests: readFileSync("src/sports/football/matches/simulateMatch.test.ts", "utf8"),
};

const required = [
  ["types", 'MatchParticipationMode = "auto" | "key-moments" | "every-snap"'],
  ["types", "lastResolvedEpisode"],
  ["types", "startFieldPosition"],
  ["forecast", "decisionScoreCenter"],
  ["simulation", "advanceAutomatic"],
  ["simulation", "decodeLivePlayOutcome"],
  ["simulation", "grossPuntYards"],
  ["engine", "stepLivePlayEngine"],
  ["engine", "function quarterbackStep"],
  ["engine", "function defenderStep"],
  ["engine", "function tackleCarrier"],
  ["engine", "function startPass"],
  ["engine", "liveRoleActions"],
  ["engine", "liveFieldViewport"],
  ["engine", "liveWorldToFieldYard"],
  ["engine", "turnoverCommitted"],
  ["engine", "missed-tackle"],
  ["engine", "passCompleted"],
  ["field", "requestAnimationFrame"],
  ["field", "liveReceiverTargets"],
  ["field", "live-joystick"],
  ["field", "live-keyboard-guide"],
  ["field", "fieldSpotLabel"],
  ["field", "endFieldPosition"],
  ["field", "player.isHero ? \"#35c96f\""],
  ["dashboard", "match-possession-dialog"],
  ["dashboard", "driveOutcomeLabel"],
  ["dashboard", "RealTimeMatchField"],
  ["dashboard", "encodeLivePlayOutcome"],
  ["today", "is-game"],
  ["today", "Матч против"],
  ["commands", "toGameDateKey(current.meta.currentDate)"],
  ["schema", "CURRENT_SCHEMA_VERSION = 35"],
  ["migrations", "migrateVersionTwentySix"],
  ["tests", "supports automatic, key-moment and every-snap participation"],
];

const failures = required
  .filter(([file, token]) => !files[file].includes(token))
  .map(([file, token]) => `${file}: missing ${token}`);

if (files.dashboard.includes("elite-match-options--v36")) failures.push("dashboard: legacy precomputed decision cards remain in live gameplay");
if (files.field.includes("MatchPlaybackPhase")) failures.push("field: scripted playback phases remain in the real-time field");
if (!files.simulation.includes("simulation.puntReturnYards ?? 0")) failures.push("simulation: punt return statistic is still reconstructed");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Match experience architecture: OK (yard camera, physical passes, real returns, desktop arrows, mobile joystick, green hero marker)");
