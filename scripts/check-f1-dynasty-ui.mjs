import { existsSync, readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const index = read("src/styles/index.css");
const tokens = read("src/styles/tokens.css");
const shell = read("src/styles/shell.css");
const management = read("src/styles/management.css");
const career = read("src/styles/career.css");
const logo = read("src/components/brand/ProspectLogo.tsx");
const recruiting = read("src/components/career/RecruitingDashboard.tsx");
const market = read("src/components/career/MarketDashboard.tsx");
const league = read("src/components/career/LeagueDirectoryDashboard.tsx");
const errors = [];

const required = [
  [tokens, "color-scheme: light", "light manager workspace is missing"],
  [tokens, "--surface: #ffffff", "paper-white content surface is missing"],
  [tokens, "--radius: 3px", "square sports-manager geometry is missing"],
  [shell, ".game-bottom-nav", "persistent primary navigation is missing"],
  [shell, ".brand__copy", "manager-style product masthead is missing"],
  [management, ".recruiting-hub", "recruiting management workspace is missing"],
  [management, ".market-hub", "transfer management workspace is missing"],
  [management, ".league-hub", "league management workspace is missing"],
  [management, ".league-power-table > button", "dense league-table language is missing"],
  [career, ".elite-standings-list", "legacy team data was not migrated into the new system"],
  [logo, "FOOTBALL MANAGEMENT", "product masthead subtitle is missing"],
  [recruiting, "recruiting-hub", "recruiting component does not use the new hierarchy"],
  [market, "market-hub", "market component does not use the new hierarchy"],
  [league, "league-hub", "league component does not use the new hierarchy"],
];
for (const [source, token, message] of required) if (!source.includes(token)) errors.push(message);

const imports = [...index.matchAll(/@import\s+["']\.\/(.+?\.css)["'];/g)].map((match) => match[1]);
if (imports.length !== 9) errors.push(`expected 9 active style modules, found ${imports.length}`);
for (const retired of ["operations.css", "compact-ui.css", "navigation.css", "world.css"]) {
  if (existsSync(new URL(`src/styles/${retired}`, root))) errors.push(`retired design file still exists: ${retired}`);
}
if (/background:\s*#0[0-9a-f]{5}/i.test(read("src/styles/foundation.css"))) errors.push("global page is still dark instead of a light management workspace");
if (/border-radius:\s*(?:1[2-9]|[2-9]\d)px/.test(management)) errors.push("large AI-card radii remain in management screens");

if (errors.length) {
  console.error("F1 Dynasty UI check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("F1 Dynasty UI OK: light browser-manager shell, dense tables, square panels and retired legacy styles.");
