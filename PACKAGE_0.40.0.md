# PROSPECT 0.40.0 package

- `PROSPECT-0.40.0-patch.zip` — новые и изменённые файлы для распаковки поверх 0.39.0.
- `PROSPECT-0.40.0-full.zip` — полный проект без `.git`, `node_modules`, `dist` и старых patch/hotfix-файлов.
- `DELETE_FILES_0.40.0.txt` — файлы предыдущих упаковок, которые удаляет установщик.

## Проверено

- строгий TypeScript project build: PASS;
- синтаксический разбор всех TS/TSX: PASS;
- девять архитектурных проверок: PASS;
- runtime smoke трёх режимов управления: PASS;
- interception probability bounds: PASS;
- 16 клубов × 53 активных игрока и salary cap: PASS;
- trade deadline: PASS;
- полный сезон 120 + 7 матчей: PASS;
- migration schema 28 → 29: PASS.

Vitest и Vite в среде упаковки не запускались: доступный `node_modules` содержит Windows native Rollup/Esbuild binaries. TypeScript, архитектурные проверки и независимый runtime smoke выполнены отдельно.
