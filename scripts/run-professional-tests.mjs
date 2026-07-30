import { spawnSync } from "node:child_process";

const files = [
  "src/sports/football/pro/draft.test.ts",
  "src/sports/football/pro/camp.test.ts",
  "src/sports/football/pro/campFreeAgency.test.ts",
  "src/sports/football/pro/leagueStructure.test.ts",
  "src/sports/football/pro/league.test.ts",
  "src/sports/football/pro/leaguePractice.test.ts",
  "src/sports/football/pro/leagueSeason.test.ts",
];

const commonArgs = [
  "node_modules/vitest/vitest.mjs",
  "run",
  "--pool=forks",
  "--environment=node",
  "--maxWorkers=1",
  "--no-file-parallelism",
  "--testTimeout=30000",
  "--hookTimeout=45000",
];

for (const file of files) {
  console.log(`\n[PRO suite] ${file}`);
  const result = spawnSync(process.execPath, [...commonArgs, file], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
