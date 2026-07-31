import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../src/styles/index.css", import.meta.url), "utf8");
const operations = readFileSync(new URL("../src/styles/operations.css", import.meta.url), "utf8");
const recruiting = readFileSync(new URL("../src/components/career/RecruitingDashboard.tsx", import.meta.url), "utf8");
const market = readFileSync(new URL("../src/components/career/MarketDashboard.tsx", import.meta.url), "utf8");
const league = readFileSync(new URL("../src/components/career/LeagueDirectoryDashboard.tsx", import.meta.url), "utf8");
const identity = readFileSync(new URL("../src/components/career/PlayerIdentityBar.tsx", import.meta.url), "utf8");
const errors = [];

const imports = [...index.matchAll(/@import\s+["']\.\/(.+?\.css)["'];/g)].map((match) => match[1]);
if (imports.at(-1) !== "operations.css") errors.push("operations.css must be the final visual layer");

const required = [
  [operations, ".career-game-shell .game-bottom-nav", "desktop operations rail is missing"],
  [operations, "--ops-paper", "high-contrast editorial surface is missing"],
  [operations, ".recruiting-board__mark", "recruiting team marks are missing"],
  [operations, ".league-featured-game", "league broadcast treatment is missing"],
  [operations, "grid-template-columns: minmax(0, 1.28fr)", "recruiting workbench split is missing"],
  [recruiting, "teamBrandStyle(program.seed)", "recruiting rows are not team-branded"],
  [market, "market-hub__scoreboard", "market masthead scoreboard is missing"],
  [league, "league-hub__scoreboard", "league masthead scoreboard is missing"],
  [identity, "teamBrandStyle", "player identity does not inherit team branding"],
];
for (const [source, token, message] of required) if (!source.includes(token)) errors.push(message);

if (operations.split(/\r?\n/).length > 650) errors.push("operations stylesheet exceeds the UI responsibility limit");
if (/border-radius:\s*(?:1[2-9]|[2-9]\d)px/.test(operations)) errors.push("large card radii remain in the operations workbench");

if (errors.length > 0) {
  console.error("Visual workbench check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Visual workbench OK: branded teams, editorial hierarchy, dense tables and desktop operations rail are active.");
