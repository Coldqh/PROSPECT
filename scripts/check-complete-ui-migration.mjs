import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const files = {
  recruiting: read("src/components/career/RecruitingDashboard.tsx"),
  market: read("src/components/career/MarketDashboard.tsx"),
  league: read("src/components/career/LeagueDirectoryDashboard.tsx"),
  world: read("src/components/career/WorldDashboard.tsx"),
  season: read("src/components/career/SeasonDashboard.tsx"),
  proSeason: read("src/components/career/ProfessionalSeasonDashboard.tsx"),
  draft: read("src/components/career/ProfessionalTransitionDashboard.tsx"),
  match: read("src/components/career/MatchDashboard.tsx"),
};
const shared = read("src/components/career/ManagerPageHeader.tsx");
const management = read("src/styles/management.css");
const career = read("src/styles/career.css");
const matchStyles = read("src/styles/match.css");
const errors = [];

for (const [name, source] of Object.entries(files)) {
  if (!source.includes("ManagerPageHeader")) errors.push(`${name}: shared manager header is missing`);
}
for (const token of ["manager-page-head", "manager-page-head__metrics", "world-command-grid", "world-news-desk"]) {
  if (!management.includes(token)) errors.push(`management workspace is missing: ${token}`);
}
for (const token of ["pro-player-banner", "season-control-grid", "professional-draft-stage--manager"]) {
  if (!career.includes(token)) errors.push(`career migration style is missing: ${token}`);
}
for (const token of ["match-scoreboard--manager", "match-upcoming--manager"]) {
  if (!matchStyles.includes(token)) errors.push(`match migration style is missing: ${token}`);
}
for (const token of ["manager-page-head__identity", "manager-page-head__metrics"]) {
  if (!shared.includes(token)) errors.push(`shared header markup is missing: ${token}`);
}
const forbiddenByFile = {
  recruiting: "recruiting-hub__head",
  market: "market-hub__head",
  league: "league-hub__head",
  world: "world-v27-head",
  season: "compact-page-head",
  proSeason: "data-page-head",
  draft: "elite-draft-header",
  match: "match-page-head",
};
for (const [name, token] of Object.entries(forbiddenByFile)) {
  if (files[name].includes(token)) errors.push(`${name}: legacy top composition remains: ${token}`);
}

if (errors.length) {
  console.error("Complete UI migration failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Complete UI migration: recruiting, market, league, world, seasons, draft and match share one manager command system.");
