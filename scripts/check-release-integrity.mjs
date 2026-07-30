import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const manifestPath = resolve(root, "scripts/release-required-files.json");
if (!existsSync(manifestPath)) {
  throw new Error("Release manifest is missing: scripts/release-required-files.json");
}
const required = JSON.parse(readFileSync(manifestPath, "utf8"));
const missing = [];
const empty = [];
for (const relativePath of required) {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) missing.push(relativePath);
  else if (statSync(absolutePath).isFile() && statSync(absolutePath).size === 0) empty.push(relativePath);
}
if (missing.length || empty.length) {
  const lines = ["Release integrity failed."];
  if (missing.length) lines.push(`Missing files (${missing.length}):\n${missing.map((path) => `- ${path}`).join("\n")}`);
  if (empty.length) lines.push(`Empty files (${empty.length}):\n${empty.map((path) => `- ${path}`).join("\n")}`);
  throw new Error(lines.join("\n"));
}
console.log(`Release integrity: OK (${required.length} required files).`);
