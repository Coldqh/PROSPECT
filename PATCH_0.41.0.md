# PROSPECT 0.41.0 — Persistent Player Lifecycle / Seamless Control

## Главное

- режимы ручного, ассистированного и spectator-управления удалены;
- герой всегда выполняет назначение автоматически;
- ввод джойстика или клавиатуры мгновенно перехватывает движение;
- после отпускания ИИ продолжает действие из текущей позиции;
- школа, колледж, драфт, pro-лига, free agency и retirement используют одну постоянную личность игрока;
- профессиональные классы формируются из настоящих выпускников автономного мира;
- фоновая школьная и университетская экосистема продолжает сезоны во время pro-карьеры;
- в World добавлен карьерный архив;
- schema сохранений повышена до 30.

## Проверки

- TypeScript: PASS;
- source boundaries: PASS;
- UI architecture: PASS;
- seamless match control: PASS;
- professional league: PASS;
- persistent player lifecycle: PASS;
- полный runtime: 112 выборов драфта, сезон, offseason, 16 × 53 ростера, синхронные 2031 pro/world seasons — PASS.
