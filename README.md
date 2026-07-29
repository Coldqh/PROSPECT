# PROSPECT

Браузерный симулятор жизни и карьеры игрока в американский футбол внутри автономной спортивной экосистемы.

## Текущий этап — 0.42.0

- замедленный real-time матч и более длинное чтение защиты QB;
- QB выбирает цель по прогрессии, separation, leverage, глубине, давлению и checkdown;
- дополнительное снижение физической и статистической частоты перехватов;
- числовая оценка 0–100 и grade за каждый снэп;
- отдельные критерии исполнения для всех четырнадцати позиций;
- WR получает отдельные оценки за маршрут и созданный отрыв, включая полезную импровизацию;
- итоговая оценка матча агрегируется из всех снэпов и сохраняется в pro game log;
- корректная работа starter, rotation, special teams, inactive и practice squad;
- исправлены full-season finalization, тяжёлые Vitest suites и миграции schema 25/26;
- автоматическая миграция schema 30 → 31.

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
powershell -ExecutionPolicy Bypass -File .\APPLY_PATCH_0.42.0.ps1
```
