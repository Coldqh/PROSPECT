# PROSPECT

Браузерный симулятор жизни и карьеры игрока в американский футбол внутри автономной спортивной экосистемы.

## Текущий этап — 0.45.1

- недельный usage plan для каждой позиции нападения;
- роли deep threat, slot option, possession target, red-zone target, receiving back и lead runner;
- play-caller вызывает концепты под роль героя;
- QB учитывает trail coverage, safety сверху, leverage и реальное окно передачи;
- чистый вертикальный отрыв поднимает героя в прогрессии;
- target share регулируется по ходу матча и не превращается в форсирование;
- routes, open windows, missed windows и separation сохраняются в истории матчей;
- save schema 33.

## Команды

```bash
npm install
npm run dev
npm run test
npm run build
```

## Установка патча на Windows

```powershell
cd C:\PROSPECT
powershell -ExecutionPolicy Bypass -File .\APPLY_PATCH_0.45.1.ps1
```


### 0.45.1

- восстановлен `src/styles/world.css` в patch ZIP и Git;
- save schema без изменений.
