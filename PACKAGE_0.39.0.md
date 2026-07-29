# PROSPECT 0.39.0 package

- `PROSPECT-0.39.0-patch.zip` — только новые и изменённые файлы для распаковки поверх 0.38.0.
- `PROSPECT-0.39.0-full.zip` — полный исходный проект без `.git`, `node_modules`, `dist` и временных файлов.
- Патч повышает schema сохранений с 27 до 28 и включает автоматическую миграцию.

## Проверено

- TypeScript project references: PASS;
- семь архитектурных проверок и шесть source-boundary тестов: PASS;
- runtime smoke: 16 клубов, 53 активных игрока на клуб, salary-cap invariant: PASS;
- полный сезон: 120 матчей регулярки + 7 матчей плей-офф: PASS;
- offseason и переход в следующий сезон: PASS;
- migration schema 27 → 28 и Zod parse: PASS.

Полный `vitest` и `vite build` в среде упаковки не запускались: загруженный `node_modules` содержит Windows native-бинарники, а восстановление Linux optional dependencies без сети недоступно.
