# PROSPECT Patch 16.4

This patch expands the foreign-source boundary guard to cover `src/app/workspaces`,
including the foreign `PopulationWorkspace.tsx` module.

After extracting over the repository, run:

```powershell
cd C:\PROSPECT
npm run fix:foreign-sources
npm test
npm run build
git status
git add -A
git commit -m "fix: remove foreign population workspace"
git push
```
