# PROSPECT

Браузерный симулятор жизни и карьеры игрока в американский футбол внутри автономной спортивной экосистемы.

## Текущий этап — 0.44.0

- полноценные штабы HC / OC / DC / POS у колледжей и PRO-команд;
- контракты, увольнения, назначения и смена систем;
- разные offensive и defensive playbook;
- адаптация к повторяющимся розыгрышам по ходу матча;
- качество штаба влияет на автономные результаты;
- scheme fit влияет на depth chart, рынок, контракт, обмен и развитие;
- FIT виден в составе команды и position room;
- save schema 32;
- исправлены career events с номером дня выше 60.

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
powershell -ExecutionPolicy Bypass -File .\APPLY_PATCH_0.44.0.ps1
```
