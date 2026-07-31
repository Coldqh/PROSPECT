import { existsSync, readFileSync, readdirSync } from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const index = read("src/styles/index.css");
const tokens = read("src/styles/tokens.css");
const dynasty = read("src/styles/dynasty.css");
const shell = read("src/styles/shell.css");
const team = read("src/components/career/TeamProfileDashboard.tsx");
const profile = read("src/components/career/PlayerProfileDashboard.tsx");
const today = read("src/components/career/TodayDashboard.tsx");
const errors = [];

const required = [
  [tokens, "color-scheme: dark", "dark sports-manager workspace is missing"],
  [tokens, "--surface: #171c24", "layered dark surface token is missing"],
  [tokens, "--accent: #ff1d45", "high-contrast red accent is missing"],
  [dynasty, ".dynasty-team-masthead", "team masthead is missing"],
  [dynasty, ".dynasty-player-card-grid", "large roster card system is missing"],
  [dynasty, ".dynasty-profile-hero", "player hero composition is missing"],
  [dynasty, ".dynasty-week-panel", "season home week panel is missing"],
  [dynasty, ".dynasty-overall-shield", "OVR shield language is missing"],
  [shell, ".game-bottom-nav", "persistent career navigation is missing"],
  [team, "dynasty-team-masthead", "team component still uses the old composition"],
  [profile, "dynasty-profile-hero", "player profile still uses the old composition"],
  [today, "dynasty-week-panel", "season home still uses the old composition"],
];
for (const [source, token, message] of required) if (!source.includes(token)) errors.push(message);

const styleFiles = readdirSync(new URL("src/styles", root)).filter((name) => name.endsWith(".css"));
const allStyles = styleFiles.map((name) => read(`src/styles/${name}`)).join("\n");
const forbiddenLightSurfaces = [
  "background: #fff",
  "background: #ffffff",
  "background: #f8fafb",
  "background: #f7f9fb",
  "background: #f6f8fa",
  "background: #f0f3f5",
  "background: #edf3f8",
  "background: #e9edf1",
  "background: #d7dde4",
  "background: rgb(255 255 255 / 94%)",
  "%, white)",
];
for (const token of forbiddenLightSurfaces) {
  if (allStyles.toLowerCase().includes(token.toLowerCase())) errors.push(`legacy light surface remains in active CSS: ${token}`);
}

const imports = [...index.matchAll(/@import\s+["']\.\/(.+?\.css)["'];/g)].map((match) => match[1]);
if (imports.at(-1) !== "dynasty.css") errors.push("reference UI stylesheet must be the final cascade module");
if (imports.length !== 10) errors.push(`expected 10 active style modules, found ${imports.length}`);
for (const retired of ["operations.css", "compact-ui.css", "navigation.css", "world.css"]) {
  if (existsSync(new URL(`src/styles/${retired}`, root))) errors.push(`retired design file still exists: ${retired}`);
}
for (const legacyToken of ["elite-team-hero", "elite-player-card", "compact-page-head", "team-depth-chart"]) {
  if (team.includes(legacyToken) || profile.includes(legacyToken) || today.includes(legacyToken)) errors.push(`legacy screen composition remains: ${legacyToken}`);
}
if (!dynasty.includes("@media (max-width: 720px)")) errors.push("mobile adaptation for reference screens is missing");
if (!dynasty.includes("linear-gradient")) errors.push("surface depth and team branding are missing");

if (errors.length) {
  console.error("Reference UI check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Reference UI OK: dark sports-manager shell, rebuilt reference screens, unified dark tables and no legacy light surfaces.");
