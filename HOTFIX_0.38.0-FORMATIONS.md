# PROSPECT 0.38.0 — Formation Geometry Hotfix

Исправлена ошибка смешивания экранных процентов и реальных ярдов.

## Исправления

- все формации переведены в реальные глубины относительно линии скримиджа;
- shotgun QB располагается в 4–5 ярдах, under-center QB — менее чем в ярде;
- DL располагаются в 0,5–1 ярде от линии;
- LB — в 3,5–5,5 ярдах;
- CB — в 1,5–4,5 ярдах;
- safety — в 9,5–14,2 ярдах;
- исправлены координаты field goal и punt formations;
- pre-snap камера центрируется на розыгрыше, а не на глубоком защитнике;
- QB, линия, linebackers и safeties одновременно видны в кадре;
- атака получила контрастный синий цвет вместо почти чёрного;
- добавлен регрессионный тест 42 сочетаний атакующих и защитных формаций;
- включён предыдущий тестовый hotfix физического паса.

## Проверки

- 42 сочетания формаций: PASS;
- 22 игрока на снэпе: PASS;
- Gun Doubles vs Dime: QB depth 5 yards, safety depth 14.2 yards;
- pre-snap viewport: QB и hero safety находятся в кадре;
- special teams LOS и глубины K/P: PASS;
- strict TypeScript для playbook и real-time engine: PASS;
- source boundaries и match experience architecture: PASS.
