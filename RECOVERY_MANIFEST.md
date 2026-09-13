# EINEIRO Recovery Manifest

This file is the source of truth after repository-history loss. A feature is considered restored only when code exists in Git; production claims require runtime/provider verification.

## Product invariants
- EINEIRO is a universal commerce platform, not an auto-dismantling-only CRM.
- Marketplace sale commission is 0%. Monetization is through transparent subscriptions, services, promotion and logistics; mandatory external costs are itemized.
- Management by exceptions: routine work stays quiet; the owner sees only decisions requiring owner authority.
- AI acts only inside policy, confidence and permission limits and writes material actions to audit.
- Market home has no product matrix before a user request.
- Camera safe zone is immutable and may not be covered, moved, reduced or reused.
- Camera/voice is the primary Market request interface.
- A request is decomposed into scene slots / requested objects. One requested object equals one object in the scene.
- Example: “полка, на которой стоит ваза и книга” = three slots: one shelf + one vase + one book.
- Every slot has exactly one currently selected product and its own full catalog of relevant variants.
- Variant count is not limited to three. Current contract supports up to 100 results per page with pagination and no artificial total cap.
- Replacing a variant changes only that slot and preserves its spatial anchor/relationship.
- Variants must never become duplicate scene objects.
- Cross-slot ranking may use product-graph relationships without merging independent slots.
- Clean View hides interface elements but keeps all placed products visible.
- Phone, tablet and desktop layouts are adaptive, not scaled copies.

## Restored in Git

### Business / command center
- Adaptive command center and AI Director.
- Autonomy score and exception queue.
- AI sales control: response-time rules, follow-up, discount/margin controls, seller scoring and suspicious-behavior signals.
- AI dispatcher/tasks with priorities and statuses.
- Price Lab with current/minimum/optimal price and guarded changes.
- Warehouse hierarchy: zone -> rack -> shelf -> cell.
- Warehouse re-slotting recommendations.
- Product inventory/publication state, strategic analytics and finance surfaces.
- Unified Inbox user interface and Market order workflow.
- Start / Pilot / Autopilot plans and 7-day grace capability model.
- Roles, permissions and audit surfaces.

### Market / spatial search
- Camera-first entry with browser camera support.
- Voice input where supported.
- Short frame burst instead of continuous video upload.
- Browser -> `/api/vision/resolve` bridge.
- Request decomposition into independent scene slots.
- One selected product per requested scene object.
- Multi-object composition such as shelf + vase + book.
- Independent full catalog per scene slot.
- Per-slot pagination through `/api/search/slots`.
- Replace-in-place while preserving each slot anchor.
- No artificial total cap on relevant variants.
- Product Graph context improves ranking of related objects without changing slot identity.
- Clean View keeps all placed products visible.
- Local development fallback is clearly separate from the real AI path.

### Multimodal AI search
- Provider-neutral VisionSearchService.
- OpenAI Responses API gateway with image input and structured JSON output.
- `store:false` requests.
- Configurable model through environment configuration; model name is not shown in product UI.
- Frame sampling and metadata minimization before external AI calls.
- Voice/context length limiting.
- Explicit instruction to ignore personal identifiers and focus on product context.
- Confidence gate: low confidence returns one clarification instead of random products.
- Each requested object creates one independent search query and scene slot.
- Each slot receives one current top offer plus its own full catalog.
- Automated tests cover multi-object decomposition, independent catalogs, minimization and confidence gating.

### Product Graph / universal category schema
- Hierarchical universal categories with category-specific attributes.
- Product validation against category attribute types.
- Product/variant graph nodes.
- Typed relationships including compatibility, complements and same family.
- Relationship-aware recommendations and ranking boosts.
- Graph-backed Market catalog source.
- Category alias normalization from user-facing labels to canonical category IDs.
- Cursor pagination.
- Automated graph/category/relation/search tests.

### Search and recommendations
- Provider-neutral search service.
- Relevance ordering.
- Independent search for multiple scene slots.
- One current offer plus full catalog per slot.
- Per-slot cursor pagination.
- Product Graph source and context-product relationship boost.

### Server security and tenant isolation
- Server-side permission checks.
- Tenant-scoped repositories, events and audit.
- Owner-decision escalation rules for low confidence, limits, legal/financial confirmations and serious anomalies.
- Password hashing with PBKDF2-SHA256 and per-user salt.
- Login, authentication, logout and session expiry.
- Same entity IDs remain isolated between companies.
- Automated security/tenant tests.

### PostgreSQL data layer
- PostgreSQL storage adapter implemented and selectable through `DATABASE_URL`.
- Automatic schema migrations.
- Tables for users, sessions, tenant records, audit and events.
- Company ID is part of tenant record keys and queries.
- User email uniqueness is scoped by company.
- Repository CRUD, authentication data, events and audit work through PostgreSQL.
- Connection pool configuration through environment settings.
- Server automatically uses PostgreSQL when configured and keeps file storage for local development.
- Automated migration/query/tenant-isolation contract tests are wired into the main check command.

### HTTP authentication / Platform API
- Bearer-session authentication.
- Auth routes for register/login/logout and current-user lookup.
- Tenant context comes from authentication, never from a client-supplied company ID.
- Endpoint-level permission enforcement.
- Versioned endpoints for products, orders, tasks, messages, events and audit.
- Tenant-scoped reads/writes.
- 401 for missing authentication and 403 for insufficient permissions.

### Third-party integration access
- Tenant-bound API keys.
- Raw key returned only at creation; only a SHA-256 hash is stored.
- Per-key permissions and request-rate limits.
- Owner/admin creation and revocation.
- External requests inherit the key's tenant.
- Automated permission/rate-limit/revocation tests.

### Import / migration center
- CSV parser with quoted-field handling.
- Simple XML item import contract.
- Configurable field mapping.
- Product + inventory normalization.
- Reverse inventory mode: stock is imported first, physical placement can be assigned later.
- Row-level error collection instead of aborting the entire import.
- Tenant-scoped imported records.

### Unified Inbox backend
- Normalized inbound message model.
- Inbound deduplication by channel + external message ID.
- Tenant-scoped message persistence.
- Outbound queue with request idempotency.
- Protection against double sending.
- Delivery states, retry/backoff and terminal failure.
- Inbox events and audit.

### Channel runtime
- Common channel-adapter contract and registry.
- Normalized webhook contract.
- Polling contract with cursor support.
- Outbound dispatch through adapters.
- EINEIRO Market has a working native adapter for messages and publication persistence.
- Avito, VK, Youla, Drom, Farpost, Auto.ru and Zzap remain explicitly unconfigured until official endpoints/credentials are verified; they no longer pretend to be operational.

### Secure channel connection configuration
- Per-company channel connection records.
- AES-256-GCM encryption for external channel credentials using `EINEIRO_SECRET_KEY`.
- Stored credentials are never returned by channel-list/read endpoints.
- Connection state tracks configured/enabled/status/last check/last success/last error.
- Protected routes for listing, saving and disabling channel connections.
- Different companies cannot read each other's channel configuration.
- Encryption and tenant-isolation checks are wired into the main test command.

### Marketplace transactions
- Tenant-scoped orders.
- Normalized order items and totals.
- Lifecycle: created -> accepted -> packing -> shipped -> delivered / returned / cancelled.
- Illegal transition protection.
- Shipment creation and tracking contracts.
- Order/shipment events and audit.

### Payments
- Provider-neutral payment registry.
- Tenant-scoped payment persistence.
- Idempotent creation and status synchronization.
- Partial/full refunds with idempotency.
- Payment/refund events and audit.

### Logistics
- Provider-neutral logistics registry.
- Tenant-scoped shipments.
- Idempotent shipment creation.
- Tracking number, tracking URL and ETA synchronization.
- Shipment history and cancellation contract.
- Shipment events and audit.

### Infrastructure
- In-process job queue with typed handlers.
- Delayed jobs, retry/backoff and max-attempt failure handling.
- Tenant-scoped job listing and queue statistics.
- Metrics registry with counters, gauges and latency observations.
- Health registry with component state.
- Public lightweight health endpoint and protected metrics/queue endpoints.
- File-storage backups with metadata, retention pruning and restore.
- Protected backup administration routes.

## Still pending for true production operation
- Cookie-based browser sessions and CSRF policy.
- Pixel-level redaction for faces/license plates before external AI calls.
- Verified real adapters and credentials/webhooks for Avito, VK, Youla, Drom, Farpost, Auto.ru and Zzap.
- Production acquiring-provider credentials and webhook wiring.
- Production transport-company credentials/API wiring.
- OAuth authorization flow for third-party integrations; scoped API keys already exist.
- External persistent queue for horizontal scaling; current queue is in-process.
- External metrics/log storage and alert delivery.
- PostgreSQL off-host backup replication and automated disaster-recovery verification.
- Production-scale external search index when in-process Product Graph search no longer meets load requirements.
- Mobile application packaging and store publication pipeline.

## Plans
- Start: free; no AI; manual warehouse operations; camera barcode scanning allowed; no API/feed publishing; limited problem analytics.
- Pilot: configured low-cost paid plan; AI recommends and a human accepts decisions; external costs are itemized.
- Autopilot: configured paid plan; AI may execute inside policy/permission limits; external costs are itemized.

## Rule for future work
No chat statement counts as implementation. Every completed feature must have a Git commit. Every production-critical feature also requires tests or runtime verification before being marked complete.
