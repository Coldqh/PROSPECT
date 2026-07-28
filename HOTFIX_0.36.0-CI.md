# PROSPECT 0.36.0 cumulative CI hotfix

This hotfix includes the earlier migration import fix and resolves the seven failing test groups reported after 0.36.0.

## Runtime fixes

- Clamps every playbook coordinate to the valid `0..100` field range.
- Preserves up to 800 ecosystem transactions instead of losing offseason events behind weekly market activity.
- Keeps graduations, coach hires and transfers visible to tests and the UI.
- Normalizes depth ranks after inserting the hero into a position room.
- Prioritizes completely empty position rooms during offseason position changes.

## Test updates

- Position pressure now expects the 14-position catalog.
- Annual freshman generation now expects one player for each of the 14 positions.
- Stability invariant allows the expanded bounded transaction history.

## Verification performed

- Match runtime completed for all 14 positions.
- Every assignment point remained inside `0..100`.
- Three autonomous seasons completed with 8 coaching changes, 198 transfers and no invariant violations.
- Graduation history survived a 140-day offseason advance.
- Every position-room depth chart was contiguous.
- All architecture checks passed.
- Syntax transpilation passed for 139 TypeScript/TSX files.
