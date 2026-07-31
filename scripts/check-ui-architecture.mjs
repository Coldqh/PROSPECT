import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const stylesDir = join(root, "src", "styles");
const componentsDir = join(root, "src", "components", "career");
const indexCss = readFileSync(join(stylesDir, "index.css"), "utf8");
const activeImports = [...indexCss.matchAll(/@import\s+["']\.\/(.+?\.css)["'];/g)].map((match) => match[1]);
const expectedImports = ["tokens.css", "foundation.css", "shell.css", "controls.css", "flows.css", "career.css", "management.css", "match.css", "motion.css"];
const retired = [
  "career-common.css", "college.css", "compact-ui.css", "elite-ui.css", "game.css", "home.css", "league.css", "legacy.css", "market.css",
  "navigation.css", "operations.css", "professional.css", "profile.css", "real-time-match.css", "recruiting.css", "redesign.css", "refinement.css",
  "season.css", "social.css", "team.css", "visual-system-v2.css", "world.css",
];
const errors = [];

if (activeImports.join("|") !== expectedImports.join("|")) errors.push(`unexpected style entrypoint: ${activeImports.join(", ")}`);
for (const file of retired) if (existsSync(join(stylesDir, file))) errors.push(`retired stylesheet still exists: ${file}`);
for (const file of expectedImports) if (!existsSync(join(stylesDir, file))) errors.push(`active stylesheet is missing: ${file}`);
if (new Set(activeImports).size !== activeImports.length) errors.push("duplicate stylesheet imports remain");

const joined = activeImports.map((file) => readFileSync(join(stylesDir, file), "utf8")).join("\n");
for (const token of ["--surface: #ffffff", "--header: #12161c", "--accent: #d31f2b", "color-scheme: light"]) {
  if (!joined.includes(token)) errors.push(`new manager token is missing: ${token}`);
}
if (!joined.includes("overflow-x: clip")) errors.push("horizontal overflow guard is missing");
if (/--elite-|@layer\s+(?:legacy|redesign|refinement|visual|elite)/.test(joined)) errors.push("versioned legacy token or cascade layer remains");
if (/100vw/.test(joined)) errors.push("100vw remains and can create mobile overflow");
for (const match of joined.matchAll(/font-size\s*:\s*([\d.]+)px/g)) {
  if (Number(match[1]) < 13) errors.push(`text below 13px remains: ${match[1]}px`);
}
for (const file of activeImports) {
  const lines = readFileSync(join(stylesDir, file), "utf8").split(/\r?\n/).length;
  if (lines > 720) errors.push(`stylesheet responsibility is overloaded (${lines} lines): ${file}`);
}

const foundation = readFileSync(join(stylesDir, "foundation.css"), "utf8");
for (const selector of ["html", "body", "#root", ".app-shell", ".screen"]) {
  if (!foundation.includes(`${selector} {`)) errors.push(`foundation geometry is missing: ${selector}`);
}
const shell = readFileSync(join(stylesDir, "shell.css"), "utf8");
for (const selector of [".app-header", ".game-bottom-nav", ".player-identity-bar", ".game-drawer"]) {
  if (!shell.includes(`${selector} {`)) errors.push(`shell selector is missing: ${selector}`);
}
const management = readFileSync(join(stylesDir, "management.css"), "utf8");
for (const selector of [".recruiting-hub", ".market-hub", ".league-hub", ".recruiting-board", ".league-power-table"]) {
  if (!management.includes(selector)) errors.push(`management workspace selector is missing: ${selector}`);
}

const nav = readFileSync(join(componentsDir, "CareerNavigation.tsx"), "utf8");
if (!nav.includes("aria-current")) errors.push("primary navigation does not expose aria-current");
const drawer = readFileSync(join(componentsDir, "CareerDrawer.tsx"), "utf8");
if (!drawer.includes("focusableSelector") || !drawer.includes("previousFocus?.focus()")) errors.push("career drawer focus trap is missing");
for (const file of readdirSync(componentsDir).filter((name) => name.endsWith(".tsx"))) {
  const lines = readFileSync(join(componentsDir, file), "utf8").split(/\r?\n/).length;
  if (lines > 520) errors.push(`career component is overloaded (${lines} lines): ${file}`);
}

if (errors.length) {
  console.error("UI architecture check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("UI architecture OK: one light manager system, nine responsibility stylesheets, no retired cascade.");
