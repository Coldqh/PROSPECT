# PROSPECT 0.45.1

Hotfix упаковки: восстановлен `src/styles/world.css`.

```powershell
cd C:\PROSPECT
# распаковать patch ZIP с заменой файлов
powershell -ExecutionPolicy Bypass -File .\APPLY_PATCH_0.45.1.ps1
npm install
npm run test
npm run build
```
