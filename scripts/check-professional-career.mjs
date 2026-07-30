import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const checks = [
  ["src/sports/football/pro/types.ts", "export type ProfessionalWeekFocus"],
  ["src/sports/football/pro/types.ts", "availability: ProfessionalAvailability"],
  ["src/sports/football/pro/league.ts", "export function setProfessionalWeekFocus"],
  ["src/sports/football/pro/league.ts", "advanceProfessionalMedical"],
  ["src/sports/football/pro/league.ts", "runProfessionalTradeDeadline"],
  ["src/sports/football/pro/league.ts", "rebuildProfessionalDepthCharts"],
  ["src/components/career/ProfessionalTransitionDashboard.tsx", "professional-week-plan"],
  ["src/components/career/ProfessionalTransitionDashboard.tsx", "heroCanPlay"],
  ["src/storage/saves/schema.ts", "injuryWeeks"],
];
for (const [path, token] of checks) {
  if (!read(path).includes(token)) throw new Error(`${path}: missing ${token}`);
}
console.log(`Professional career architecture: ${checks.length} checks passed.`);
