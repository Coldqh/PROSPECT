# Установка PROSPECT 0.41.0

## Патч поверх 0.40.0

1. Распаковать `PROSPECT-0.41.0-patch.zip` прямо в `C:\PROSPECT` с заменой файлов.
2. Запустить:

```powershell
cd C:\PROSPECT
powershell -ExecutionPolicy Bypass -File .\APPLY_PATCH_0.41.0.ps1
npm install
npm run test
npm run build
npm run dev
```

## Полный архив

`PROSPECT-0.41.0-full.zip` содержит проект без `node_modules`, `.git` и сборочного мусора.
