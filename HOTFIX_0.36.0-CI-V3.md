# PROSPECT 0.36.0 cumulative CI hotfix v3

## Problem

All 117 assertions passed, but Vitest returned exit code 1 because the combined stability test file remained active for 60.146 seconds. Vitest 3 uses an internal 60-second RPC response timeout for `onTaskUpdate`, so the completed suite was reported as an unhandled worker error.

## Fix

- Split the three-season coherence check and deterministic two-season comparison into separate test files.
- Added one shared stability fixture.
- Added `test:unit` and `test:stability` scripts.
- The two long suites now run in separate Vitest processes with one worker and disabled file parallelism.
- Kept all previous migration, roster, coordinate, transaction-history and offseason test fixes.

No gameplay or simulation rules were changed.
