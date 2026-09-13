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
- A user request is decomposed into **scene slots / requested objects**, not into a fixed number of product candidates.
- One requested object equals one object placed in the scene. Example: “полка, на которой стоит ваза и книга” = 3 slots: one shelf + one vase + one book.
- Each scene slot has exactly one currently selected/placed product at a time.
- Each scene slot has its **own full relevant catalog of variants**. The catalog is not limited to 3 products and may contain any number of genuinely relevant variants; current contract supports up to 100 per page with pagination/lazy loading and no artificial total cap.
- Selecting another variant replaces only that slot’s product and preserves that slot’s spatial anchor/relationship.
- Variants must never be represented as duplicate scene objects.
- The number of scene objects is driven only by the user’s intent/context, not by a UI cap.
- Cross-slot recommendations may use Product Graph relationships (compatible/complements/same family), but must never merge independent scene slots.
- Clean View hides UI but keeps all placed scene objects visible.
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
- Short camera-frame burst instead of continuous video upload
- Browser -> `/api/vision/resolve` bridge
- Request decomposition into independent scene slots
- One selected product per requested scene object
- Multi-object composition: e.g. shelf + vase + book appear simultaneously as three different objects, not variants
- Independent full variant catalog per scene slot
- Per-slot pagination through `/api/search/slots`
- Replace-in-place for a slot while preserving its anchor
- No artificial cap on total relevant variants per slot
- Product Graph context can improve the ranking of related objects without changing slot identity
- Clean View keeps all placed products visible
- Local development fallback is clearly separate from the real AI path

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

### HTTP auth / Platform API
- Bearer-session authentication middleware over the restored session service
- `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/me`
- Tenant context is derived from the authenticated session, not accepted from request payloads
- RBAC checks enforced at endpoint level
- Versioned `/api/v1/` resources for products, orders, tasks, messages, events and audit
- Tenant-scoped reads/writes through the durable repository
- 401 for unauthenticated requests and 403 for insufficient role permissions
- Same resource IDs remain isolated between companies
- Automated HTTP auth/RBAC/tenant-isolation tests wired into `npm run check`

### Public integration API
- Tenant-bound API keys for third-party CRMs
- Raw API tokens are returned only at creation time; stored records contain a SHA-256 hash
- `X-API-Key` authentication alongside Bearer sessions
- Per-key scopes such as `products:read`, `products:write`, `orders:read`, `messages:write`
- Scope enforcement on Platform API resources
- Per-key request rate limiting with 429 / retry metadata
- Owner/admin key creation and revocation endpoints
- API-key requests inherit the key's tenant; clients cannot supply another `companyId`
- Automated scope/rate-limit/revocation/tenant tests wired into `npm run check`

### Import / migration center
- CSV parser with quoted-field handling
- Simple XML `<item>` import contract
- Configurable field mapping from external CRM schemas
- Product + inventory normalization into EINEIRO entities
- Reverse inventory mode: imported stock exists immediately while physical placement remains pending
- Imported inventory can be assigned to warehouse cells after migration instead of blocking the import
- Row-level error collection instead of aborting the entire import
- Tenant-scoped imported records
- Automated CSV/XML/reverse-inventory tests wired into `npm run check`

### Product Graph / universal category schema
- Universal hierarchical category schema with category-specific attributes
- Product validation against category attribute types
- Product graph nodes for products/variants
- Typed relations such as `compatible_with`, `complements`, and `same_family`
- Relation-aware recommendations
- Relation/context boost in product search
- Graph-backed catalog source wired into Market runtime
- Category alias normalization from user-facing labels to universal category IDs
- Cursor pagination across graph search results
- Automated graph/category/relation/search/pagination tests wired into `npm run check`

### Search / recommendation runtime
- Provider-neutral SearchService
- Normalized relevance ordering
- Independent `searchSlots` execution for multiple scene objects
- One current top offer per slot plus full per-slot catalog
- Per-slot cursor pagination
- Graph-backed search source
- Context-product relationship boost
- Automated independent-slot, graph and pagination tests

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

### Payments backend
- Provider-neutral payment registry
- Tenant-scoped payment persistence
- Payment create/sync lifecycle
- Idempotent payment creation
- Partial/full refund support
- Idempotent refunds
- Payment/refund audit + event emission

### Logistics backend
- Provider-neutral logistics registry
- Tenant-scoped shipment persistence
- Idempotent shipment creation
- Tracking number / tracking URL / ETA synchronization
- Shipment history
- Shipment cancellation contract
- Shipment audit + event emission
- Automated payments/logistics tests wired into `npm run check`

### Multimodal Vision backend
- Provider-neutral VisionSearchService
- OpenAI Responses API gateway with image input
- Structured Outputs JSON Schema for **requested object / scene-slot decomposition**
- `store:false` requests
- Configurable model via `OPENAI_MODEL`; model name is not exposed in product UI
- Frame sampling with bounded frame count and minimum frame gap
- Metadata minimization before frames leave the trusted boundary
- Voice/context length limiting
- Explicit instruction to ignore personal identifiers and focus on product-relevant context
- Confidence gate: low-confidence requests return one clarification instead of product search
- Each requested object produces one scene slot and one independent search query
- Each slot receives one current top offer plus its own full relevant variant catalog
- Full per-slot catalog supports pagination / up to 100 results per page and no artificial total cap
- Variants do not create duplicate scene objects
- Tenant-scoped audit/events for vision resolution
- Automated tests for shelf + vase + book decomposition, independent catalogs, current-offer selection, minimization and confidence gating

## Required production restoration still pending
These were part of the agreed product but still need runtime/provider implementation:
- Production database adapter (PostgreSQL or equivalent) and deployment migrations; durable provider-neutral adapter exists
- Cookie-based browser session transport / CSRF policy; Bearer HTTP auth is restored
- Pixel-level redaction provider for faces/license plates before external AI calls; metadata minimization hook exists
- Real Avito/Drom/Farpost/Auto.ru/VK/Youla/Zzap provider adapters and credentials/webhook wiring; contracts/runtime now exist
- Production acquiring provider credentials/webhook wiring; payment contract/service exists
- Production transport-company provider credentials/API wiring; logistics contract/service exists
- OAuth 2.0 authorization flow for third-party integrations; scoped API keys already exist
- Production-scale external search index (OpenSearch/Elasticsearch/vector or equivalent) replacing the in-process Product Graph index when scale requires it
- Queues/workers beyond inbox delivery dispatch
- Observability/health metrics
- Automated per-company/platform backups and disaster recovery
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
