# EINEIRO Platform — Level 4 Hard Audit Snapshot

**Дата:** 2026-09-13  
**Версия кода:** 0.39.0-recovery  
**Статус:** PRE-FINAL / recovery snapshot, НЕ Freeze decision

## 0. Правило этого snapshot

Этот документ не заменяет финальный `EINEIRO_Level_4_Hard_Audit_v1` после полного восстановления.

Статусы означают:

- `PASS` — архитектурная реализация присутствует в текущем Git и соответствует каноническому направлению.
- `PARTIAL` — код/архитектура есть, но отсутствует обязательная интеграция, production-like проверка, реальный внешний контур или полный end-to-end.
- `FAIL` — обязательный критерий ещё не выполнен либо требует реального пилота/инфраструктуры, которой сейчас нет.

Наличие файла или UI само по себе не считается `PASS`.

---

# 1. Freeze checklist — предварительный статус

| Критерий | Статус | Текущее доказательство / причина |
|---|---|---|
| Product / Offer / SKU universal | PASS | `offers.mjs`, `sku-inventory.mjs`, universal import создаёт Product + SKU + Offer + Inventory. |
| Auto Parts outside Core | PASS | `auto-domain.mjs`; автомобильная специфика не является базовой моделью Core. |
| Category Schema versioned | PASS | `category-schema.mjs`; отдельная схема категории и обязательные атрибуты. |
| Event Layer production-ready | PARTIAL | `event-layer.mjs`, `contour-runtime.mjs`, cross-contour tests есть; production durability/replay/large-load ещё не доказаны. |
| Decision Engine shared by >= 3 contours | PASS | общий `decision-engine.mjs` + `autonomy-orchestrator.mjs`; Marketing/Procurement/Director и др. подключаются через общий слой. |
| Policy Engine mandatory | PASS | `policy-engine.mjs`, `decision-engine.mjs`, `autonomy-orchestrator.mjs`; ALLOW/DENY/REQUIRE_APPROVAL/ALLOW_WITH_LIMIT. |
| Risk Engine works | PASS | risk levels/factors встроены в Policy/Decision foundation; high-risk переводится в approval/step-up. |
| Audit unified | PASS | `audit-log.mjs` + Control Plane Audit; единые поля actor/action/object/reason/decision/policy/before/after/result/rollback. |
| Feature Flags production-ready | PARTIAL | `feature-flags.mjs` и Control Plane управление есть; реальный staged rollout в production не подтверждён. |
| AI Provider Layer provider-independent | PASS | `ai-provider-layer.mjs`, provider capability/routing/fallback. |
| Privacy Gateway works | PASS | `privacy-gateway.mjs`; PII minimization/redaction, raw media block и external-AI block. |
| Connector Framework production-ready | PARTIAL | `connector-framework.mjs`, bridge и health есть; несколько РЕАЛЬНЫХ внешних каналов через общий framework ещё не подтверждены. |
| Search separated from LLM | PASS | `search-engine-v2.mjs`; LLM даёт structured intent, финальный список выбирает Search Engine. |
| Recommendation separated from Search | PASS | `recommendation-engine.mjs` отдельным сервисом. |
| Unified Inbox adapter-based | PASS | inbox/connectors + adapter model; старые channel adapters сохраняются через bridge. |
| Commerce universal | PARTIAL | Product→Offer→Negotiation→Order→Payment→Fulfillment→Shipment→Return→Review разложено по универсальным модулям; полный production-like E2E ещё не прогнан. |
| Service / ServiceOffer supported | PASS | `fulfillment.mjs` содержит Operator/Location/ServiceOffer и partner/operator-first routing. |
| Disagreement model implemented | PASS | `returns-disagreements.mjs`; ordinary return отделён от mismatch/damage, fact-finding и evidence. |
| Roles capability-based | PASS | `security-hardening.mjs`; CompanyMembership capabilities + backend enforcement foundation. |
| Control Plane v2 usable | PASS | платформенные разделы + Health/Audit/Flags/Moderation/Experiments; `admin.js`, `control-plane-api.mjs`. |
| Observability usable | PASS | `observability.mjs`; service/queue/connector/webhook/AI/decision/policy/retry/DLQ. |
| Backup restore verified | PARTIAL | `disaster-recovery.mjs` умеет verify + dryRunRestore и показывает ready только после обоих; реальный production-like restore ещё не зафиксирован. |
| Spatial foundation without Core change | PASS | `spatial-foundation.mjs`, `spatial-reconstruction.mjs`; SpatialAsset/SpatialCapture — расширение, не изменение universal commerce Core. |
| WP-13B contextual realtime AR commerce E2E | PARTIAL | camera-first/spatial UI foundation и slot/anchor mechanics есть, но обязательный production-like E2E на поддерживаемых устройствах ещё не подтверждён. |
| Camera Session without mandatory video file/raw stream | PARTIAL | архитектурное правило заложено; device/runtime acceptance ещё не проведён. |
| Contextual Product Rail inside Camera/AR | PARTIAL | UI foundation есть; full real-device acceptance не проведён. |
| Drag-to-place + swap-in-place preserves anchor | PARTIAL | spatial slot/anchor contract есть; device runtime acceptance не проведён. |
| New categories mostly config/module work | PARTIAL | Universal Core/Schema/Module architecture это поддерживает, но подтверждение требует multi-category pilot. |
| Pilot Wave 1 complete | FAIL | 45-компанейный pilot не проведён. |
| Remediation complete | FAIL | невозможен до Wave 1. |
| Pilot Wave 2 complete | FAIL | 30-компанейный второй pilot не проведён. |
| Core Escape Rate >= 90–95% target | FAIL | метрика требует результатов реального multi-category pilot. |

---

# 2. Implementation waves — статус

## WAVE 0 — Finish current specs

`PARTIAL`

- backend recovery snapshot фактически ведётся;
- canonical recovery manifest существует;
- migration map частично восстановлен по сущностям;
- полный аудит всех Library/чатовых решений ещё продолжается.

## WAVE 1 — Platform Foundation P0

`PASS / PARTIAL at runtime`

Реализованы:
- Universal Core foundation;
- Category Schema;
- Event Layer;
- Decision Engine;
- Policy/Risk;
- unified Audit;
- Feature Flags;
- AI Provider Layer;
- Privacy Gateway;
- Connector Framework.

Блокер: production verification Feature Flags/Connector Framework и durability Event Layer.

## WAVE 2 — Commerce Foundation

`PASS / PARTIAL E2E`

Реализованы:
- Product/Offer/SKU/Inventory;
- universal import;
- orders/payments/logistics;
- fulfillment;
- returns/disagreement;
- Negotiation;
- Unified Inbox/adapters;
- seller reputation/post-sale feedback.

Блокер: один полный production-like commerce E2E на нескольких категориях.

## WAVE 3 — AI Contours

`PASS architecture / PARTIAL live execution`

Восстановлены:
- Sales foundation;
- Warehouse intelligence;
- Price Lab;
- Finance guard/ledger;
- Marketing Autopilot + Memory;
- Procurement;
- Channel Allocator;
- AI Director V2;
- Autonomy Engine.

Блокер: доказать, что все ключевые live-actions реально проходят Event → Decision → Policy в runtime, а не только в тестовых/модульных сценариях.

## WAVE 4 — Market Intelligence

`PASS architecture / PARTIAL live vision`

Реализованы:
- Search Engine V2;
- Recommendation Engine;
- Product Graph;
- Vision foundation;
- Unserved Demand;
- Saved Demand;
- Demand Loop / ProductionOpportunity;
- Compatibility Gate.

Блокер: production-like Vision/Search flow и реальные multimodal provider calls через Privacy Gateway.

## WAVE 5 — Control & Operations

`PASS architecture / PARTIAL infrastructure`

Реализованы:
- Control Plane V2;
- contextual onboarding;
- Observability;
- DR verification model;
- security hardening;
- capability access;
- Health view.

Блокеры:
- реальный backup restore rehearsal;
- secrets vault / deployment-level encryption/TLS validation;
- admin MFA production flow;
- webhook signature verification across real connectors;
- full security review/load test.

## WAVE 6 — Spatial Level 4

`PARTIAL`

Реализованы:
- SpatialAsset;
- SpatialCapture;
- LiDAR/photogrammetry/import contract;
- reconstruction provider interface;
- measured-vs-visual fallback gate;
- spatial evidence integration with Disagreement.

Блокеры:
- реальный 3D viewer/runtime verification;
- capture/reconstruction on supported devices;
- end-to-end WP-13B acceptance;
- latency/FPS/device fallback measurements.

## WAVE 7 — Multi-category Pilot

`FAIL / not started`

Требуется:
- Wave 1: 3 компании × 15 категорий = 45;
- remediation;
- Wave 2: 2 компании × 15 категорий = 30;
- все Core escapes классифицировать;
- измерить Core Escape Rate;
- только затем финальный Freeze audit.

---

# 3. Главные оставшиеся блокеры до финального Level 4 Hard Audit

## P0 — нельзя объявлять Freeze без этого

1. **Несколько реальных внешних Connector Framework интеграций.**
   - EINEIRO Market foundation есть.
   - Avito adapter есть.
   - Остальные каналы без подтверждённых credentials/endpoints не считать live.

2. **Проверенный backup restore в production-like окружении.**
   - наличие backup не считается.
   - нужен integrity check + dry-run/isolated restore + фиксация результата.

3. **WP-13B end-to-end на реальных поддерживаемых устройствах.**
   - camera-first;
   - significant frames, а не full recording;
   - voice context;
   - Privacy Gateway;
   - Search/Recommendation;
   - contextual product rail;
   - drag-to-place;
   - anchor persistence;
   - swap-in-place;
   - clean view;
   - network/provider degraded modes.

4. **Security NFR production verification.**
   - secret vault;
   - tenant credential isolation;
   - encryption at rest / TLS deployment validation;
   - admin MFA real flow;
   - webhook verification;
   - file validation;
   - abuse/security tests.

5. **Multi-category pilot Wave 1 + remediation + Wave 2.**
   Без этого невозможно честно посчитать Core Escape Rate и поставить Freeze.

## P1 — добить до pilot

6. Seller Waitlist + category activation by supply/feature flag.
7. Полный commerce E2E на нескольких категориях.
8. Реальный provider-independent multimodal Vision flow.
9. Feature Flag staged rollout rehearsal.
10. Real connector/webhook retry/idempotency/recovery scenarios.
11. 3D viewer/capture/reconstruction device acceptance.
12. Migration review legacy users/data with no privilege leakage.

---

# 4. Что уже принципиально изменилось относительно исходного EP Base

Текущая recovery-архитектура уже не является CRM авторазбора:

- automotive logic вынесена из общего Core;
- Product / Offer / SKU / Inventory разделены;
- Event / Decision / Policy стали общими платформенными примитивами;
- AI contours связываются через события и governance;
- Search не равен LLM;
- Recommendation не равен Search;
- деньги продавца не покупают organic relevance и внимание покупателя;
- Unserved Demand и Demand Loop стали платформенными активами;
- Identity отделена от роли/компании;
- Control Plane управляет платформой, а не одним бизнесом;
- Spatial layer расширяет Market, не ломая Core;
- partner/operator-first fulfillment не требует владения всей физической инфраструктурой.

---

# 5. Freeze decision на текущий момент

## `NOT READY TO FREEZE`

Причина не в отсутствии базовой архитектуры — она в значительной части восстановлена.

Причина в том, что Hard Audit требует доказательств реального исполнения:

- production-like runtime;
- реальные connectors;
- verified restore;
- device Spatial/Vision E2E;
- multi-category pilot;
- measured Core Escape Rate.

Следующая задача recovery-разработки: закрывать P0/P1 пробелы, затем повторить этот документ уже как полный `PASS / PARTIAL / FAIL` аудит с фактическими runtime-доказательствами.
