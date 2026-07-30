# PROSPECT 0.43.1

Hotfix regression-теста длинного тачдауна.

```powershell
cd C:\PROSPECT
# Распаковать PROSPECT-0.43.1-patch.zip с заменой файлов
powershell -ExecutionPolicy Bypass -File .\APPLY_PATCH_0.43.1.ps1
npm install
npm run test
npm run build
```
