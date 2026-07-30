# PROSPECT 0.43.2

Hotfix случайной позиции в профессиональных тестах.

```powershell
cd C:\PROSPECT
# Распаковать PROSPECT-0.43.2-patch.zip с заменой файлов
powershell -ExecutionPolicy Bypass -File .\APPLY_PATCH_0.43.2.ps1
npm install
npm run test
npm run build
```
