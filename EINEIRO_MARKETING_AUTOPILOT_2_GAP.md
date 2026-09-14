# EINEIRO — Marketing Autopilot 2.0 GAP

**Источник истины:** `EINEIRO_Marketing_Autopilot_2_Spec.md` v2.1 (Library)  
**Дата фиксации:** 14 сентября 2026  
**Статус:** P0 control plane implemented; paid traffic remains blocked

## Реализовано в этой итерации

- создан отдельный backend-контур `PLATFORM_ACQUISITION`; seller marketing не используется для привлечения EINEIRO;
- серверные независимые флаги Silent Run: Platform Acquisition включён, seller campaigns/connectors, offer promotion, Sponsored Showcase и commercial payments выключены;
- старые seller marketing POST-операции fail-closed по умолчанию;
- прямой запуск и создание Sponsored Showcase блокируются сервером независимо от UI;
- platform budget нельзя направить на seller, product или offer;
- добавлены дневной/недельный/месячный лимиты, предел изменения бюджета и cost/quality guardrails;
- запуск требует одновременно `Policy=ALLOW`, `Finance=ALLOW` и connector `CERTIFIED`; исключение ROOT OWNER имеет reason, TTL и spend cap;
- реализованы global/granular stop paths и kill switch с попыткой остановить внешние live campaigns;
- добавлены provider-neutral Connector SDK, capability registry и lifecycle;
- зарегистрированы Yandex Direct и VK Ads как два независимых P0-канала; секреты не возвращаются API/UI;
- connector не может перейти в `CERTIFIED` без доказательств реальной публикации и live metrics;
- добавлена псевдонимная attribution chain от impression/click до resolved intent, seller interaction и D1/D7/D30;
- PII-ключи и raw tokens запрещены в attribution/Flight Recorder;
- experiment evaluator не выбирает результат до min spend/min resolved intents и останавливает кампанию по FAS/error/cost guardrails;
- Daily Owner Report считает стоимость camera start/intent/resolved intent, activation, FAS и retention;
- в Admin добавлен отдельный раздел «Привлечение EINEIRO» с 12 зонами, флагами, каналами и kill switch.

## Что намеренно не считается готовым

- Yandex Direct и VK Ads остаются `DISCOVERED`/`CONFIGURED`, а не `CERTIFIED`: реальных credentials, кабинетов, публикаций и live metrics в репозитории нет;
- никакой fake-success или подмена внешней публикации локальной записью не используется;
- paid traffic и любое списание бюджета заблокированы до certification;
- Creative Factory пока не имеет production image/video renderers и полного provenance/moderation pipeline;
- Scheduler closed loop и automatic safe reallocation между каналами ещё не подключены к background runtime;
- attribution ingest пока owner-only; перед внешним трафиком нужен подписанный Conversion API/webhook с replay protection;
- Marketing Memory ещё не является обязательным входом перед каждой новой гипотезой;
- Admin показывает control/status shell, но не полный редактор кампаний и creative review workflow.

## Обязательные P0 до первого рекламного рубля

1. Подключить реальные Yandex Direct и VK Ads drivers через SDK, хранить credentials только в secret manager.
2. Для каждого канала выполнить AUTHENTICATED → SANDBOX_TESTED → LIVE_TESTED → CERTIFIED и сохранить evidence.
3. Провести реальную малую публикацию, подтвердить pause/resume, budget control, live metrics и webhook/conversion loop.
4. Подключить подписанный attribution endpoint с idempotency/replay protection и E2E-проверкой до `INTENT_RESOLVED`.
5. Подключить production renderers, factual claims validation, moderation и provenance.
6. Подключить scheduler, Marketing Memory lookup, Finance/Policy decisions и Daily Owner Report delivery.
7. Подтвердить backup/restore, rollback, monitoring и ноль открытых P0 security incidents.

## Решение по запуску

`NO-GO` для paid traffic. Архитектурный P0-каркас и fail-closed барьеры готовы; внешний расход денег остаётся технически невозможен без реальных credentials, evidence и ROOT OWNER configuration.
