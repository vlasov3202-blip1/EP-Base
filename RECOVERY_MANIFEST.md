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

### Server core
- Multi-company tenant key isolation
- Server-side RBAC permission checks
- Tenant-scoped repository interface with in-memory reference implementation
- Tenant-scoped event bus
- Tenant-scoped audit log
- Owner decision escalation gate by confidence / limits / legal / financial / anomaly reasons
- Durable JSON storage adapter with atomic writes
- Schema migrations and schema-version tracking
- Server-side user records scoped by company
- Password hashing via PBKDF2-SHA256 with per-user salt
- Login / authenticate / logout session management
- Session expiry handling
- Tenant-scoped durable repository reload verification
- Runtime data files excluded from Git
- Automated core/auth/storage tests wired into `npm run check`

### Unified Inbox backend
- Provider-neutral connector registry
- Normalized inbound message model
- Inbound deduplication by channel + external message ID
- Tenant-scoped inbox persistence
- Outbound queue with client request idempotency key
- Anti-double-send protection
- Delivery status tracking: queued / retry / sent / failed
- Exponential retry/backoff for transient send failures
- Terminal failure after configurable max attempts
- Tenant-scoped inbox events and audit entries
- Automated dedup/idempotency/retry tests wired into `npm run check`

### Connector runtime
- Base adapter contract with declared capabilities
- Provider registry
- Normalized webhook contract
- Polling contract with cursor support
- Outbox dispatch through provider adapters
- Webhook/polling audit + event emission
- Default adapter slots for EINEIRO Market, Avito, VK, Youla, Drom, Farpost, Auto.ru and Zzap

### Marketplace transaction backend
- Tenant-scoped order persistence
- Order item normalization and totals
- Lifecycle: created -> accepted -> packing -> shipped -> delivered / returned / cancelled
- Illegal state-transition protection
- Shipment creation contract
- Tracking synchronization contract
- In-memory shipment provider reference implementation
- Order/shipment audit + event emission
- Automated connector/order lifecycle tests wired into `npm run check`

## Required production restoration still pending
These were part of the agreed product but still need runtime/provider implementation:
- Production database adapter (PostgreSQL or equivalent) and deployment migrations; durable provider-neutral adapter exists
- HTTP/API authentication middleware and cookie/header transport; session service exists
- Real OpenAI multimodal gateway and provider abstraction runtime
- Vision frame sampling/anonymization pipeline
- Real Avito/Drom/Farpost/Auto.ru/VK/Youla/Zzap provider adapters and credentials/webhook wiring; contracts/runtime now exist
- Production acquiring/payment provider integration
- Production transport-company shipment creation and tracking providers
- Import/migration center for external CRM CSV/XML
- Product Graph / universal category schema persistence
- Search/recommendation service
- Queues/workers beyond inbox delivery dispatch
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
