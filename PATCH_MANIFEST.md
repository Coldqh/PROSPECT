# PROSPECT 0.43.3 patch manifest

Base version: `0.43.2`  
Target version: `0.43.3`  
Save schema: `31` (unchanged)

## Fix

Relationship events no longer fail after an option is selected. The streaming checksum supports undefined optional fields, resolved pending events are omitted from state, and failed persistence leaves the event open for retry.

## Files

Replacement and new files are listed in `PATCH_FILES_0.43.3.txt`.
Files removed from 0.43.2 are listed in `DELETE_FILES_0.43.3.txt`.
