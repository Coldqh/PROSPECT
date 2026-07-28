# PROSPECT 0.36.0 — migration import hotfix

## Исправлено

- В `createFootballCareer.ts` добавлен runtime-импорт `CAREER_FOOTBALL_POSITIONS` из `./types`.
- `createLegacyFootballSetup()` больше не падает с `ReferenceError` при миграции сохранений версий 1–10.

## Причина

Константа использовалась во время выполнения, но после расширения карьерных позиций не была импортирована как значение. TypeScript-типов было недостаточно: Vitest доходил до `random.pick(CAREER_FOOTBALL_POSITIONS)` и получал неопределённую переменную.

## Проверено

- все архитектурные проверки PROSPECT проходят;
- целевая TypeScript-транспиляция создаёт реальный JavaScript import для `CAREER_FOOTBALL_POSITIONS`;
- патч содержит только исправленный исходный файл и эту справку.
