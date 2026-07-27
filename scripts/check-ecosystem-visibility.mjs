import { readFileSync } from "node:fs";

const required = [
  ["src/components/career/CareerDrawer.tsx", 'id: "market"'],
  ["src/screens/CareerOverviewScreen.tsx", "<MarketDashboard"],
  ["src/components/career/CollegeCareerDashboard.tsx", "<MarketDashboard"],
  ["src/components/career/TeamProfileDashboard.tsx", 'id: "planning"'],
  ["src/components/career/TeamProfileDashboard.tsx", 'id: "history"'],
  ["src/styles/index.css", '@import "./market.css"'],
];
const forbidden = [
  ["src/sports/football/ecosystem/simulateEcosystem.ts", "function simulateCollegeTeams"],
  ["src/sports/football/ecosystem/simulateEcosystem.ts", "function chooseCommitment"],
  ["src/sports/football/ecosystem/simulateEcosystem.ts", "function simulateRecruitingMarket"],
  ["src/sports/football/ecosystem/simulateEcosystem.ts", "function processTransfers"],
];
const failures = [];
for (const [file, token] of required) {
  const source = readFileSync(file, "utf8");
  if (!source.includes(token)) failures.push(`${file}: missing ${token}`);
}
for (const [file, token] of forbidden) {
  const source = readFileSync(file, "utf8");
  if (source.includes(token)) failures.push(`${file}: legacy duplicate remains: ${token}`);
}
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Ecosystem visibility architecture: OK");
