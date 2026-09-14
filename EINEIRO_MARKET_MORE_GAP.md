# EINEIRO Market — GAP по вкладке «Ещё»

Источник истины: `EINEIRO_Market_More_Tab_Spec_v1.md`, версия 1.0 от 14.09.2026.  
Проверенная ветка: `feature/algorithm-first-moderation-p0`.

## GAP до внедрения

| Требование | Исходный статус | Найденная основа |
|---|---|---|
| Корень «ПРОФИЛЬ → МОЁ → СИСТЕМА» | отсутствует | отсутствовал Market router вторичных экранов |
| Профиль и приватность | частично | `Identity`, `BuyerProfile`, security/privacy services |
| Сэйвы Product + Context/Intent | частично | `SavedDataService`, миграция anonymous state |
| Мои сцены с восстановлением Context/Scene | отсутствует | spatial assets/captures есть, пользовательской `SavedScene` нет |
| История заказов | частично | `OrderService`, но buyer UI отсутствовал |
| Доставка | частично | `Shipment`/logistics есть, общего buyer overview не было |
| Return отдельно от Disagreement | готово в domain / отсутствует в UI | отдельные `ReturnService` и `DisagreementService` |
| «Сообщить, когда появится» | частично | `SavedDemandService` и matching есть, buyer UI отсутствовал |
| Уведомления | частично | `BuyerNotificationEngine` есть, buyer archive отсутствовал |
| Chats с закреплённым обращением к EINEIRO | отсутствует | seller inbox не являлся buyer Chats |
| Deep Links и сохранение Scene/Context при возврате | отсутствует | отсутствовал Market router |
| Flight Recorder | отсутствует | общего события для этой поверхности не было |

## Статус после первого среза

- Готово: канонический корень из трёх блоков и всех 14 пунктов.
- Готово: отдельные empty states; Return и Disagreement не объединены.
- Готово: `Chats` вынесен из «Ещё», «Написать в поддержку» закреплено сверху.
- Готово: deep links `?market=detail&item=...`; возврат сохраняет текущий runtime Scene/Context.
- Готово: единый нижний bar с прямым `tap → Camera`; вкладка не пересекается с Camera Safe Zone.
- Готово: серверный Flight Recorder с allowlist, фильтрацией reference IDs, защитным заголовком и rate limits.
- Частично: реальные персональные списки пока не отдаются в UI без аутентифицированного buyer API; вместо выдуманных данных показываются честные empty states.
- Отсутствует: пользовательская сущность `SavedScene` и операция восстановления Scene/Context из постоянного хранилища.
- Отсутствует: создание обращения EINEIRO через buyer Chats backend.

## Следующий исполняемый срез

1. Добавить аутентифицированный buyer snapshot API без межпользовательского доступа.
2. Связать Order → Delivery → Return → Disagreement по `identity_id`/`order_id`.
3. Добавить `SavedScene` с версионированным multi-object Context и безопасным resume.
4. Подключить архив BuyerNotification без дублирования Chats.
5. Создать отдельный тип обращения EINEIRO и передавать `context_id`, `order_id` или `disagreement_id`.
