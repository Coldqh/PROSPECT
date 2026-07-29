# Установка PROSPECT 0.42.2

1. Убедиться, что установлена версия 0.42.1.
2. Распаковать `PROSPECT-0.42.2-patch.zip` в `C:\PROSPECT` с заменой файлов.
3. Запустить:

```powershell
cd C:\PROSPECT
powershell -ExecutionPolicy Bypass -File .\APPLY_PATCH_0.42.2.ps1
npm install
npm run test
npm run build
npm run dev
```

Save schema не менялась. Старые сохранения совместимы.
