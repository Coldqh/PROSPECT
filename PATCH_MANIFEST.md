# PROSPECT 0.43.0 patch manifest

Base version: `0.42.3`  
Target version: `0.43.0`  
Save schema: `31`

## Scope

- match grading rebuilt around position production and error cost;
- QB reads, pressure response and pocket movement rebuilt;
- route, collision, pass-rush and sack frequency stabilized;
- possession-change report added;
- match, recruiting and market interfaces reduced to functional data;
- direct college and PRO league directory added;
- autosave storage reduced to one current snapshot and periodic backups.

## Files

The patch contains 40 replacement or new files listed in `PATCH_FILES_0.43.0.txt`.
Files removed from 0.42.3 are listed in `DELETE_FILES_0.43.0.txt`.

## Verification

- TypeScript project typecheck: PASS;
- source boundaries: PASS;
- UI architecture: PASS;
- match architecture: PASS;
- professional league architecture: PASS;
- player lifecycle: PASS;
- performance grading: PASS;
- functional-copy gate: PASS;
- 12-game QB/LB/EDGE simulation batches: PASS;
- starter/rotation/special/inactive/practice-squad smoke: PASS;
- patch/full parity and ZIP integrity are checked during packaging.
