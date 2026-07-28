# PROSPECT 0.36.0 cumulative CI/build hotfix v4

Includes every fix from v3 and resolves the ten TypeScript build errors reported after the green 117-test run.

## Build fixes

- College game logs now use the complete `MatchStatLine` contract.
- Legacy game logs receive safe zero defaults for newly introduced statistics.
- Exact full-match statistics are persisted into the college career log.
- Draft production supports both legacy partial and current full stat records.
- Player profile career totals use an explicit full-stat accumulator.
- Special-teams assignment arrays are typed as `MatchPlayerAssignment[]`.
- React 19 `useRef` is initialized explicitly.

## Verification performed in the patch environment

- 141 TS/TSX files parsed without syntax errors.
- All six source-boundary tests passed.
- UI, ecosystem visibility, full roster, playable position, and match experience architecture checks passed.
- Focused hotfix invariants passed.

A complete `npm run build` still has to run in the repository with its installed dependencies.
