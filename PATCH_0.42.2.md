# PROSPECT 0.42.2 — Professional Test Suite CI Hotfix

Исправлено падение GitHub Actions после фактически успешных профессиональных тестов.

## Изменения

- монолитный PRO-suite разделён на три независимых файла;
- повторная тяжёлая генерация мира заменена общими immutable fixtures;
- каждый suite запускается отдельным процессом Vitest;
- PRO-тесты используют `node` + `forks`;
- setup совместим с `node` и `jsdom`;
- добавлена архитектурная защита структуры тестов;
- save schema не менялась.

## Установка

Распаковать архив поверх PROSPECT 0.42.1 с заменой файлов и запустить:

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_PATCH_0.42.2.ps1
npm install
npm run test
npm run build
```
