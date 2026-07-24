import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const stylesDir = join(root, "src", "styles");
const componentsDir = join(root, "src", "components", "career");
const indexCss = readFileSync(join(stylesDir, "index.css"), "utf8");
const activeImports = [...indexCss.matchAll(/@import\s+["']\.\/(.+?\.css)["'];/g)].map((match) => match[1]);
const retired = ["legacy.css", "redesign.css", "refinement.css", "game.css", "visual-system-v2.css", "elite-ui.css"];
const errors = [];

function matchingBrace(source, openIndex) {
  let depth = 0;
  let quote = "";
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote && source[index - 1] !== "\\") quote = "";
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function inspectRules(source, file, selectorMap, context = "root") {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  let cursor = 0;
  while (cursor < css.length) {
    const open = css.indexOf("{", cursor);
    if (open < 0) break;
    const close = matchingBrace(css, open);
    if (close < 0) { errors.push(`unclosed CSS block: ${file}`); break; }
    let prelude = css.slice(cursor, open).trim();
    const lastSemicolon = prelude.lastIndexOf(";");
    if (lastSemicolon >= 0) prelude = prelude.slice(lastSemicolon + 1).trim();
    const body = css.slice(open + 1, close);
    if (/^@(media|supports|container|layer)\b/.test(prelude)) {
      inspectRules(body, file, selectorMap, `${context}|${prelude}`);
    } else if (!prelude.startsWith("@") && prelude) {
      const key = `${context}|${prelude.replace(/\s+/g, " ")}`;
      const previous = selectorMap.get(key);
      if (previous) errors.push(`duplicate selector: ${prelude} (${previous}, ${file})`);
      else selectorMap.set(key, file);

      const declarations = new Map();
      for (const raw of body.split(";")) {
        const colon = raw.indexOf(":");
        if (colon < 0 || raw.includes("{")) continue;
        const property = raw.slice(0, colon).trim();
        if (!property || property.startsWith("@")) continue;
        if (declarations.has(property)) errors.push(`duplicate property ${property} in ${file}: ${prelude}`);
        declarations.set(property, true);
      }
    }
    cursor = close + 1;
  }
}

for (const file of retired) {
  if (activeImports.includes(file)) errors.push(`retired stylesheet is still imported: ${file}`);
  const lines = readFileSync(join(stylesDir, file), "utf8").trim().split(/\r?\n/).length;
  if (lines > 2) errors.push(`retired stylesheet contains ${lines} lines: ${file}`);
}

const duplicateImports = activeImports.filter((file, index) => activeImports.indexOf(file) !== index);
if (duplicateImports.length > 0) errors.push(`duplicate stylesheet imports: ${[...new Set(duplicateImports)].join(", ")}`);

const selectorMap = new Map();
const domainLeaks = {
  "home.css": [".profile-", ".team-", ".social-", ".match-", ".professional-", ".recruiting-", ".season-"],
  "profile.css": [".team-", ".social-", ".match-", ".professional-", ".recruiting-", ".season-"],
  "team.css": [".profile-", ".social-", ".match-", ".professional-", ".recruiting-", ".season-"],
  "social.css": [".profile-", ".team-", ".match-", ".professional-", ".recruiting-", ".season-"],
  "match.css": [".profile-", ".team-", ".social-", ".professional-", ".recruiting-", ".season-"],
  "professional.css": [".profile-", ".team-", ".social-", ".match-", ".recruiting-", ".season-"],
};

for (const file of activeImports) {
  const css = readFileSync(join(stylesDir, file), "utf8");
  const lines = css.split(/\r?\n/).length;
  if (file !== "tokens.css" && lines > 650) errors.push(`stylesheet is overloaded (${lines} lines): ${file}`);
  if (/100vw/.test(css)) errors.push(`100vw can create mobile overflow: ${file}`);
  if (/--elite-/.test(css)) errors.push(`obsolete elite token namespace remains: ${file}`);
  if (/margin-(?:left|right)\s*:\s*-\d/.test(css)) errors.push(`negative horizontal margin remains: ${file}`);
  if (/@layer\s+(?:legacy|redesign|refinement|visual|elite)/.test(css)) errors.push(`version-based cascade layer remains: ${file}`);
  if (!["foundation.css", "tokens.css"].includes(file) && /font-family\s*:|\bmonospace\b|ui-monospace/.test(css)) errors.push(`secondary font definition remains: ${file}`);
  for (const match of css.matchAll(/font-size\s*:\s*([\d.]+)px/g)) {
    if (Number(match[1]) < 13) errors.push(`text below caption scale (${match[1]}px): ${file}`);
  }
  for (const match of css.matchAll(/letter-spacing\s*:\s*([\d.]+)em/g)) {
    if (Number(match[1]) > 0.08) errors.push(`excessive letter spacing (${match[1]}em): ${file}`);
  }
  for (const prefix of domainLeaks[file] ?? []) {
    if (css.includes(prefix)) errors.push(`domain selector ${prefix} leaked into ${file}`);
  }
  inspectRules(css, file, selectorMap);
}

const motionCss = readFileSync(join(stylesDir, "motion.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
if (/^[^@\s][^{]+\{/m.test(motionCss)) errors.push("motion.css contains component selectors instead of keyframes only");

const navigationCss = readFileSync(join(stylesDir, "navigation.css"), "utf8");
const bottomNavBlock = navigationCss.match(/\.game-bottom-nav\s*\{([\s\S]*?)\}/)?.[1] ?? "";
if (!/left:\s*0/.test(bottomNavBlock) || !/right:\s*0/.test(bottomNavBlock) || !/margin:\s*0 auto/.test(bottomNavBlock)) {
  errors.push("bottom navigation is not centered with left/right auto geometry");
}
if (/translateX\(-50%\)/.test(bottomNavBlock)) errors.push("bottom navigation still uses translateX centering");

const foundationCss = readFileSync(join(stylesDir, "foundation.css"), "utf8");
for (const selector of ["html", "body", "#root", ".app-shell", ".screen"]) {
  if (!foundationCss.includes(`${selector} {`)) errors.push(`foundation geometry is missing: ${selector}`);
}
if (!foundationCss.includes("overflow-x: clip")) errors.push("horizontal overflow guard is missing");

const college = readFileSync(join(componentsDir, "CollegeCareerDashboard.tsx"), "utf8");
if (college.includes('<main className="college-career-main">')) errors.push("nested <main> remains in CollegeCareerDashboard");

const nav = readFileSync(join(componentsDir, "CareerNavigation.tsx"), "utf8");
if (!nav.includes("aria-current")) errors.push("primary navigation does not expose aria-current");
if (!nav.includes('active === item.id ? "is-active"')) errors.push("primary navigation active state is not exclusive");

const drawer = readFileSync(join(componentsDir, "CareerDrawer.tsx"), "utf8");
if (!drawer.includes("focusableSelector") || !drawer.includes("previousFocus?.focus()")) errors.push("career drawer focus trap is missing");

for (const file of readdirSync(componentsDir).filter((name) => name.endsWith(".tsx"))) {
  const lines = readFileSync(join(componentsDir, file), "utf8").split(/\r?\n/).length;
  if (lines > 500) errors.push(`career component is overloaded (${lines} lines): ${file}`);
}

if (errors.length > 0) {
  console.error("UI architecture check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`UI architecture OK: ${activeImports.length} responsibility-based stylesheets, no duplicate selectors, no sub-caption text, one font family.`);
