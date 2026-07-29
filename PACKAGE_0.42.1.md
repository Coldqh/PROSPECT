# Установка PROSPECT 0.42.1

1. Распаковать `PROSPECT-0.42.1-patch.zip` в `C:\PROSPECT` с заменой файлов.
2. Выполнить:

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_PATCH_0.42.1.ps1
npm install
npm run test
npm run build
npm run dev
```

Патч ставится поверх версии 0.42.0. Save schema не менялась.
