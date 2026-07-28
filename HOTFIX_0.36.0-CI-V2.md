# PROSPECT 0.36.0 cumulative CI hotfix v2

This archive includes every earlier 0.36.0 CI correction and fixes the three remaining failing ecosystem tests.

## Runtime fixes retained

- Imports `CAREER_FOOTBALL_POSITIONS` for legacy save migration.
- Clamps every playbook coordinate to the valid `0..100` field range.
- Preserves up to 800 ecosystem transactions.
- Normalizes depth ranks after inserting the hero.
- Prioritizes completely empty position rooms during offseason position changes.
- Removes the duplicate roster-plan `version` field.

## Remaining CI fixes

- Stability history now expects the initial talent class plus one record per completed season, capped at 20.
- The scholarship test fixture makes its intended no-aid starter the unique eligible candidate.
- The 140-day offseason integration test receives a 90-second timeout instead of Vitest's default 5 seconds.

## Verification

- All six source-boundary tests pass.
- UI, ecosystem visibility, full-roster, playable-position and match-experience architecture checks pass.
- Syntax transpilation passes for all 139 TypeScript/TSX files.
