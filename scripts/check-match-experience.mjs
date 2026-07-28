import { readFileSync } from "node:fs";

const files = {
  types: readFileSync("src/sports/football/matches/types.ts", "utf8"),
  forecast: readFileSync("src/sports/football/matches/decisionForecast.ts", "utf8"),
  simulation: readFileSync("src/sports/football/matches/simulateMatch.ts", "utf8"),
  field: readFileSync("src/components/career/MatchField.tsx", "utf8"),
  dashboard: readFileSync("src/components/career/MatchDashboard.tsx", "utf8"),
  today: readFileSync("src/components/career/TodayDashboard.tsx", "utf8"),
  repository: readFileSync("src/storage/saves/CareerRepository.ts", "utf8"),
  schema: readFileSync("src/storage/saves/schema.ts", "utf8"),
  migrations: readFileSync("src/storage/saves/migrations.ts", "utf8"),
  tests: readFileSync("src/sports/football/matches/simulateMatch.test.ts", "utf8"),
};

const required = [
  ["types", 'MatchParticipationMode = "auto" | "key-moments" | "every-snap"'],
  ["types", "lastResolvedEpisode"],
  ["types", "startFieldPosition"],
  ["forecast", "decisionScoreCenter"],
  ["simulation", "decisionScoreCenter(save, match, selected)"],
  ["simulation", "selected.upside"],
  ["simulation", "advanceAutomatic"],
  ["simulation", "const directPressureMoment"],
  ["simulation", "const decisivePrimaryRole"],
  ["simulation", "grossPuntYards"],
  ["field", 'MatchPlaybackPhase = "pre-snap"'],
  ["field", "match-field__first-down"],
  ["dashboard", '"key-moments"'],
  ["dashboard", "Analysis Mode"],
  ["dashboard", "calculateDecisionForecast"],
  ["today", "is-game"],
  ["today", "Матч против"],
  ["repository", "toGameDateKey(current.meta.currentDate)"],
  ["schema", "CURRENT_SCHEMA_VERSION = 27"],
  ["migrations", "migrateVersionTwentySix"],
  ["tests", "supports automatic, key-moment and every-snap participation"],
];
const failures = required.filter(([file, token]) => !files[file].includes(token)).map(([file, token]) => `${file}: missing ${token}`);
if (files.dashboard.includes("function optionSuccess")) failures.push("dashboard: legacy fake success percentage remains");
if (files.simulation.includes('episode.playCall.canCheck || episode.opponentCall.canCheck')) failures.push("simulation: key moments still stop on every available pre-snap check");
if (!files.simulation.includes("simulation.puntReturnYards ?? 0")) failures.push("simulation: punt return statistic is still reconstructed");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("Match experience architecture: OK (timeline, modes, calendar, forecasts, exact play results)");
