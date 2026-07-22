import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectSourceBoundaries } from "./check-source-boundaries.mjs";
import { removeForeignSources } from "./apply-prospect-source-cleanup.mjs";

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "prospect-boundaries-"));
  mkdirSync(join(root, "src", "app"), { recursive: true });
  mkdirSync(join(root, "src", "core", "random"), { recursive: true });
  writeFileSync(
    join(root, "src", "app", "App.tsx"),
    'import { AppRoutes } from "./routes";\nexport function App(){ return AppRoutes; }\n',
  );
  writeFileSync(join(root, "src", "core", "random", "SeededRandom.ts"), "export class SeededRandom {}\n");
  return root;
}

test("accepts the current PROSPECT source layout", () => {
  const root = createFixture();
  try {
    assert.deepEqual(inspectSourceBoundaries(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects foreign gameplay and city source trees", () => {
  const root = createFixture();
  try {
    mkdirSync(join(root, "src", "gameplay", "economy"), { recursive: true });
    mkdirSync(join(root, "src", "simulation", "population"), { recursive: true });
    mkdirSync(join(root, "src", "world", "city"), { recursive: true });
    writeFileSync(join(root, "src", "gameplay", "economy", "localEconomy.ts"), "export {};\n");
    writeFileSync(join(root, "src", "world", "city", "districtPulse.ts"), "export {};\n");
    writeFileSync(join(root, "src", "simulation", "population", "populationSystem.ts"), "export {};\n");

    const violations = inspectSourceBoundaries(root);
    assert.ok(violations.some((item) => item.path === "src/gameplay"));
    assert.ok(violations.some((item) => item.path === "src/world"));
    assert.ok(violations.some((item) => item.path === "src/simulation/population"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects the foreign App shell imports", () => {
  const root = createFixture();
  try {
    writeFileSync(
      join(root, "src", "app", "App.tsx"),
      'import { NeonShell } from "./layout/NeonShell";\nexport function App(){ return NeonShell; }\n',
    );

    const violations = inspectSourceBoundaries(root);
    assert.ok(violations.some((item) => item.kind === "forbidden-import"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("requires the canonical SeededRandom.ts and rejects lowercase imports", () => {
  const root = createFixture();
  try {
    assert.deepEqual(inspectSourceBoundaries(root), []);

    writeFileSync(
      join(root, "src", "core", "life.ts"),
      'import { SeededRandom } from "./random/seededRandom";\nexport { SeededRandom };\n',
    );
    let violations = inspectSourceBoundaries(root);
    assert.ok(violations.some((item) => item.kind === "foreign-signature"));

    rmSync(join(root, "src", "core", "life.ts"));
    rmSync(join(root, "src", "core", "random", "SeededRandom.ts"));
    violations = inspectSourceBoundaries(root);
    assert.ok(violations.some((item) => item.kind === "missing-canonical-file"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("rejects foreign application workspaces", () => {
  const root = createFixture();
  try {
    mkdirSync(join(root, "src", "app", "workspaces"), { recursive: true });
    writeFileSync(
      join(root, "src", "app", "workspaces", "PopulationWorkspace.tsx"),
      'import type { WorldState } from "../../world/state/types";\nexport const PopulationWorkspace = (_props: WorldState) => null;\n',
    );

    const violations = inspectSourceBoundaries(root);
    assert.ok(violations.some((item) => item.path === "src/app/workspaces"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("cleanup removes every foreign source tree", () => {
  const root = createFixture();
  try {
    mkdirSync(join(root, "src", "app", "workspaces"), { recursive: true });
    mkdirSync(join(root, "src", "gameplay", "economy"), { recursive: true });
    mkdirSync(join(root, "src", "simulation", "population"), { recursive: true });
    writeFileSync(join(root, "src", "app", "workspaces", "PopulationWorkspace.tsx"), "export {};\n");
    writeFileSync(join(root, "src", "gameplay", "economy", "localEconomy.ts"), "export {};\n");
    writeFileSync(join(root, "src", "simulation", "population", "populationSystem.ts"), "export {};\n");

    const removed = removeForeignSources(root);
    assert.ok(removed.includes("src/app/workspaces"));
    assert.ok(removed.includes("src/gameplay"));
    assert.ok(removed.includes("src/simulation/population"));
    assert.ok(existsSync(join(root, "src", "core", "random", "SeededRandom.ts")));
    assert.deepEqual(inspectSourceBoundaries(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
