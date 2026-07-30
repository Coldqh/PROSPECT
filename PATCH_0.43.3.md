# PROSPECT 0.43.3 — Conversation Completion Hotfix

- исправлено падение checksum на `undefined` после завершения разговора;
- `pendingEvent` физически удаляется из состояния;
- интерфейс закрывает событие только после успешного сохранения;
- добавлены проверки repository persistence и optional save fields;
- save schema не менялась.
