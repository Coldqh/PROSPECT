# PROSPECT 0.45.1 patch manifest

Base version: `0.45.0`  
Target version: `0.45.1`  
Save schema: `33` (unchanged)

## Fix

`src/styles/world.css` was present in the full archive but missing from the patch archive and Git checkout. The hotfix restores it and validates it during installation.
