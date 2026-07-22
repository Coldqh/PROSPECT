import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIRECTORY, "..");

export const FORBIDDEN_SOURCE_PATHS = Object.freeze([
  "src/gameplay",
  "src/people",
  "src/world",
  "src/ui",
  "src/app/layout",
  "src/app/providers",
  "src/app/workspaces",
  "src/core/events",
  "src/core/ids",
  "src/core/saves",
  "src/core/simulation",
  "src/core/storage",
  "src/core/time",
  "src/core/version",
  "src/core/random/seededRandom.ts",
]);

const FORBIDDEN_APP_IMPORTS = Object.freeze([
  "./layout/NeonShell",
  "./providers/useWorldSave",
  "./providers/useVersionGuard",
  "../core/events/types",
  "../core/ids/entityId",
  "../core/simulation/eventQueue",
  "../core/storage/localStore",
  "../core/time/gameTime",
  "../core/version/versionService",
  "../ui/theme/settings",
]);

function exactEntryExists(parentPath, expectedName) {
  if (!existsSync(parentPath)) {
    return false;
  }

  return readdirSync(parentPath).some((entry) => entry === expectedName);
}

function exactPathExists(root, relativePath) {
  const segments = relativePath.split("/");
  let current = root;

  for (const segment of segments) {
    if (!exactEntryExists(current, segment)) {
      return false;
    }
    current = join(current, segment);
  }

  return existsSync(current);
}

function collectFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result;
}

export function inspectSourceBoundaries(repositoryRoot = DEFAULT_ROOT) {
  const root = resolve(repositoryRoot);
  const violations = [];

  for (const forbiddenPath of FORBIDDEN_SOURCE_PATHS) {
    if (exactPathExists(root, forbiddenPath)) {
      violations.push({
        kind: "forbidden-path",
        path: forbiddenPath,
        message: `Чужой исходный путь находится внутри PROSPECT: ${forbiddenPath}`,
      });
    }
  }

  const appPath = join(root, "src", "app", "App.tsx");
  if (existsSync(appPath) && statSync(appPath).isFile()) {
    const source = readFileSync(appPath, "utf8");
    for (const fragment of FORBIDDEN_APP_IMPORTS) {
      if (source.includes(fragment)) {
        violations.push({
          kind: "forbidden-import",
          path: relative(root, appPath).split(sep).join("/"),
          message: `App.tsx импортирует модуль другой архитектуры: ${fragment}`,
        });
      }
    }
  }

  const sourceFiles = collectFiles(join(root, "src"));
  for (const filePath of sourceFiles) {
    const normalized = relative(root, filePath).split(sep).join("/");
    if (!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(normalized)) {
      continue;
    }

    const source = readFileSync(filePath, "utf8");
    if (source.includes("districtPulse") || source.includes("housingSystem") || source.includes("pressureSystem")) {
      violations.push({
        kind: "foreign-signature",
        path: normalized,
        message: `В файле найден импорт/код чужого проекта: ${normalized}`,
      });
    }
  }

  return violations;
}

export function assertSourceBoundaries(repositoryRoot = DEFAULT_ROOT) {
  const violations = inspectSourceBoundaries(repositoryRoot);
  if (violations.length === 0) {
    return;
  }

  const details = violations.map((violation) => `- ${violation.message}`).join("\n");
  throw new Error(`Source boundary check failed:\n${details}`);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    assertSourceBoundaries(DEFAULT_ROOT);
    console.log("PROSPECT source boundaries: OK");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error("Run: npm run fix:foreign-sources");
    process.exitCode = 1;
  }
}
