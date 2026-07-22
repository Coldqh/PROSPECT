import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FORBIDDEN_SOURCE_PATHS, assertSourceBoundaries } from "./check-source-boundaries.mjs";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIRECTORY, "..");

export function removeForeignSources(repositoryRoot = DEFAULT_ROOT) {
  const root = resolve(repositoryRoot);
  const removed = [];

  for (const relativePath of FORBIDDEN_SOURCE_PATHS) {
    const target = join(root, ...relativePath.split("/"));
    if (!existsSync(target)) {
      continue;
    }

    rmSync(target, { recursive: true, force: true });
    removed.push(relativePath);
  }

  assertSourceBoundaries(root);
  return removed;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const removed = removeForeignSources(DEFAULT_ROOT);
    if (removed.length === 0) {
      console.log("Foreign PROSPECT sources were not found.");
    } else {
      console.log("Removed foreign source paths:");
      for (const item of removed) {
        console.log(` - ${item}`);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
