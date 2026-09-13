# EINEIRO Recovery Manifest

Status source of truth after repository-history loss. A feature is considered **restored** only when code exists in Git.

## Product invariants
- Universal commerce platform, not an auto-dismantling-only CRM.
- 0% marketplace sale commission. Monetization: transparent subscriptions/services/promotion/logistics; mandatory external costs itemized.
- Management by exceptions: normal processes stay quiet; owner sees only decisions requiring owner authority.
- AI acts within policy/confidence/role limits and writes to audit.
- Market home has no product matrix before a user request.
- Camera safe zone is immutable and may not be covered, moved, reduced or reused.
- Camera/voice is the primary Market request interface.
- Context product dock shows up to 3 relevant offers after a request.
- Spatial anchor persists when replacing a product.
- Clean View hides UI but keeps the placed product visible.
- Mobile/tablet/desktop layouts are adaptive, not simple scaled copies.

## Restored in Git
### Business
- Adaptive command center / AI Director
- Autonomy score
- Exceptions queue
- AI-ROP: first response SLA <= 5 min, follow-up, discount/margin controls, seller scoring, suspicious behavior
- AI Dispatcher / tasks with priorities and statuses
- AI Price Lab: current / minimum / optimal price and guarded application
- Warehouse: zone -> rack -> shelf -> cell
- Warehouse AI re-slotting demonstration
- Product inventory and publication status
- Strategic analytics
- Finance surface
- Connector center
- Unified Inbox: conversation -> customer -> product -> seller -> order
- Market order workflow: created -> packing -> shipped -> tracking
- Plans: Start / Pilot / Autopilot
- 7-day grace capability model
- Roles / permissions model
- Audit log

### Market
- Camera-first entry
- Real browser camera via getUserMedia when permission/device allow it
- Voice request via SpeechRecognition where supported
- Context classification into scene/category
- Up to 3 contextual product offers in bottom dock
- Place/replace product in scene
- Clean View
- Category-aware scene switching

### Admin
- Platform-control surface
- Tenant/company health
- Exception queue
- Notifications count
- Backup status surface
- Platform system pulse

### Level-4 platform core
- Universal entity list
- Event -> facts -> policy -> confidence -> decision -> action -> audit pipeline
- Owner-decision reasons
- Connector capability matrix
- AI provider abstraction config
- Product invariants in code
- Platform-layer registry

## Required production restoration still pending
These were part of the agreed product but need server-side/runtime implementation rather than UI/state simulation:
- Persistent server database and migrations
- Authentication/session management
- Enforced RBAC/permissions server-side
- Multi-company tenant isolation
- Real OpenAI multimodal gateway and provider abstraction runtime
- Vision frame sampling/anonymization pipeline
- Real Avito/Drom/Farpost/Auto.ru/VK/Youla/Zzap connectors and webhooks/polling
- Unified Inbox backend with deduplication, retries and anti-double-send
- Marketplace transaction backend
- Acquiring/payment provider integration
- Transport-company shipment creation and tracking APIs
- Import/migration center for external CRM CSV/XML
- Product Graph / universal category schema persistence
- Search/recommendation service
- Queues/workers
- Observability/health metrics
- Automated per-company/platform backups and disaster recovery
- Platform API for third-party CRMs
- Mobile-app packaging/publication pipeline

## Plans
### Start
Free. No AI. Manual warehouse CRUD. Camera barcode scanning allowed. No API/feed publishing. Problem analytics limited.

### Pilot
5 USD-equivalent/month display policy as configured by billing locale. AI recommendations; human accepts decisions. External costs are itemized.

### Autopilot
15 USD-equivalent/month display policy as configured by billing locale. AI may execute inside policy/permission limits. External costs are itemized.

## Rule for future work
No chat statement counts as implementation. Every completed feature must have a Git commit. Every production-critical feature also needs a test or runtime verification record before being marked complete.
