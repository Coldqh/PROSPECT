import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const types = read("src/sports/football/matches/types.ts");
const engine = read("src/sports/football/matches/realTimeEngine.ts");
const simulation = read("src/sports/football/matches/simulateMatch.ts");
const evaluation = read("src/sports/football/matches/performanceEvaluation.ts");
const league = read("src/sports/football/pro/league.ts");

const assertions = [
  [types.includes("MatchSnapEvaluation"), "snap evaluation contract"],
  [types.includes("MatchGameEvaluation"), "game evaluation contract"],
  [engine.includes("quarterbackTargetRead"), "QB target progression"],
  [engine.includes("routeAdherence"), "route adherence telemetry"],
  [simulation.includes("aggregateMatchEvaluation"), "match grade aggregation"],
  [evaluation.includes("routeCriteria") && evaluation.includes("coverageCriteria"), "position-specific criteria"],
  [league.includes("entryQuarter") && league.includes("benchSummary"), "bench participation model"],
  [league.includes("performanceScore: match.finalResult.score"), "persistent professional match grade"],
  [engine.includes("minimumReadTime") && engine.includes("qbDecisionQuality"), "deliberate QB decision timing"],
  [engine.includes("distanceToSegment"), "route adherence measured against route segments"],
];
for (const [ok, label] of assertions) {
  if (!ok) throw new Error(`Missing ${label}`);
}
console.log(`performance grading checks passed (${assertions.length})`);
