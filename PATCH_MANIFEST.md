# PROSPECT 0.53.1 patch manifest

Base version: `0.53.0`  
Target version: `0.53.1`  
Save schema: `35` (unchanged)  
Ecosystem module: `14` (unchanged)  
IndexedDB schema: `2` (unchanged)

## Dark surface consistency

- all active tables and list surfaces use the dark token system;
- searches, dialogs, empty states and sticky action bars no longer flash white;
- alternating rows and hover states remain visible without breaking contrast;
- automated UI checks reject legacy light backgrounds.

Replacement and new files are listed in `PATCH_FILES_0.53.1.txt`.
