# EINEIRO Recovery Manifest

This file is the source of truth after repository-history loss. A feature is considered restored only when code exists in Git; production claims require runtime/provider verification. The canonical product definition is `EINEIRO_CANONICAL.md` and overrides old EP Base behavior where they conflict.

## Product invariants
- EINEIRO is a universal commerce platform, not an auto-dismantling-only CRM.
- Marketplace sale commission is 0%. Monetization is through transparent subscriptions, services, promotion and logistics; mandatory external costs are itemized.
- Management by exceptions: routine work stays quiet; the owner sees only decisions requiring owner authority.
- AI acts only inside policy, confidence and permission limits and writes material actions to audit.
- Market home has no ordinary product matrix before a user request.
- Limited Showcase Cards are allowed on Market home as clearly separate premium placement and must not affect organic relevance.
- Camera safe zone is immutable and may not be covered, moved, reduced or reused.
- Camera/voice is the primary Market request interface.
- A request is decomposed into scene slots / requested objects. One requested object equals one object in the scene.
- Example: “полка, на которой стоит ваза и книга” = three slots: one shelf + one vase + one book.
- Every slot has exactly one currently selected product and its own full catalog of relevant variants.
- Variant count is not limited to three. Current contract supports up to 100 results per page with pagination and no artificial total cap.
- Replacing a variant changes only that slot and preserves its spatial anchor/relationship.
- Variants must never become duplicate scene objects.
- Cross-slot ranking may use Product Graph relationships without merging independent slots.
- Clean View hides interface elements but keeps all placed products visible.
- Phone, tablet and desktop layouts are adaptive, not scaled copies.
- Old EP Base automotive behavior belongs only to the automotive domain module and is not the universal product model.

## Restored in Git

### Canonical product split
- `EINEIRO_CANONICAL.md` defines the current product model and explicitly prevents old EP Base behavior from becoming the main product by accident.
- Business entry now loads `eineiro-business.js`, a universal command center, instead of the old auto-dismantling-oriented `app.js`.
- Automotive donor/OE/applicability/warranty logic remains isolated in `server/auto-domain.mjs` as a domain module.

### EINEIRO Business / Adaptive Command Center
- Universal command center with operational main screen, sales, tasks, Price Lab, warehouse, products, analytics, finance and integrations.
- Adaptive command-center concept and AI Director.
- Autonomy score and exception queue.
- AI sales control: response-time rules, follow-up, discount/margin controls, seller scoring and suspicious-behavior signals.
- AI dispatcher/tasks with priorities and statuses.
- Price Lab with current/minimum/optimal price and guarded changes.
- Warehouse hierarchy: zone -> rack -> shelf -> cell.
- Warehouse re-slotting recommendations and step-by-step placement guidance.
- Product inventory/publication state, strategic analytics and finance surfaces.
- Unified Inbox user interface and Market order workflow.
- Start / Pilot / Autopilot plans and 7-day grace capability model.
- Roles, permissions and audit surfaces.
- Contextual onboarding: normal interface first, dim everything except the highlighted control, then short guided explanations.
- Owner view separates routine notifications from decisions that truly require the owner.
- 30-day forecast and external-signal cards restored as owner context rather than automatic commands.
- Morning owner report shows business state, AI actions, estimated extra sales and whether intervention is required.
- Main-screen personalization supports hiding/reordering blocks.

### AI operations / management by exceptions
- Employee-correction chain: warning -> hint -> task -> verification -> retraining -> owner escalation.
- Correction steps may create staff tasks, personal training assignments and owner exceptions with estimated loss.
- Warehouse planning uses demand, age, heavy-item safety and fast/slow zones.
- 30-day forecast combines internal metrics with external signals.
- Morning report keeps routine AI actions separate from material owner decisions.
- AI Seller supports grounded reply suggestions, duty scheduling, follow-up creation and listing improvement using system facts only.
- AI costs are recorded in `у.е.` and can be summarized by feature without exposing provider/model details in the product UI.
- Notifications are separated into routine, owner decision, platform issue, appeal, task and training flows.

### Price Lab / pricing policy
- Server-side price recommendations use current price, cost, demand, stock age and market reference.
- Seller prices below minimum or outside the allowed range require approval.
- Approved price changes write a durable price-change record.

### Warehouse intelligence
- Prioritizes work by urgency, demand, customer wait state, age and blocking status.
- Assigns tasks using employee load and heavy-item capability.
- Placement guide chooses suitable cells and produces step-by-step instructions.
- Warehouse exceptions are stored separately from routine tasks.

### Plans and economics
- Server-side Start / Pilot / Autopilot capability rules restored.
- Grace period enforces: no AI, manual warehouse operations, barcode camera allowed, no API/feed publishing and limited analytics.
- Marketplace sale commission is hard-coded as 0% in order economics.
- Acquiring, logistics, returns, promotion and paid services are itemized separately.
- Channel-specific publication guards can reject unsupported category/condition combinations.

### Market / spatial search
- Camera-first request flow with browser camera support.
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
- Visual capability model: standard media, 360 object, spatial placement, wall placement, body try-on, face try-on, vehicle try-on and measured 3D.
- Scene packs for room, garage, desk, body, face and measured-space contexts.
- Scan patterns differ by scene type.
- Phone, tablet and desktop use different camera-safe-zone geometry and catalog/control composition.
- Product visual assets carry isolation/3D readiness state so poor raw photos can be normalized before spatial placement.
- Market home supports limited premium Showcase Cards without turning them into the ordinary pre-query catalog.

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

### Product Graph / universal category schema
- Hierarchical universal categories with category-specific attributes.
- Product validation against category attribute types.
- Product/variant graph nodes.
- Typed relationships including compatibility, complements and same family.
- Relationship-aware recommendations and ranking boosts.
- Graph-backed Market catalog source.
- Category alias normalization from user-facing labels to canonical category IDs.
- Cursor pagination.

### Automotive domain module
- Donor vehicle entity.
- OE / cross numbers / internal article / barcode / applicability.
- Default 14-day warranty and category-specific exceptions.
- Photo acceptance uses the first four images and may resolve an existing or new product.
- Donor-derived applicability is auto-filled when appropriate.
- This module is optional and must not shape unrelated categories.

### EINEIRO Admin / Control Plane
- Admin surface now loads live server overview instead of hard-coded demonstration companies and incidents.
- Live overview reports storage type, companies, users, records, open exceptions, unread notifications, AI cost and company-backup count.
- Company health is derived from real stored exceptions and failed background jobs.
- Admin remains an exception-first control plane, not a decorative dashboard.

### Server security and tenant isolation
- Server-side permission checks.
- Tenant-scoped repositories, events and audit.
- Owner-decision escalation rules for low confidence, limits, legal/financial confirmations and serious anomalies.
- Password hashing with PBKDF2-SHA256 and per-user salt.
- Login, authentication, logout and session expiry.
- Same entity IDs remain isolated between companies.
- Bearer sessions remain available for integrations.
- Browser session transport is restored with HttpOnly session cookie, separate CSRF token cookie and CSRF enforcement on state-changing browser requests.

### PostgreSQL data layer
- PostgreSQL storage adapter selectable through `DATABASE_URL`.
- Automatic schema migrations.
- Tables for users, sessions, tenant records, audit and events.
- Company ID is part of tenant record keys and queries.
- User email uniqueness is scoped by company.
- Repository CRUD, authentication data, events and audit work through PostgreSQL.
- Server automatically uses PostgreSQL when configured and keeps file storage for local development.
- Store can enumerate companies and export one company for isolated backup/restore.

### Platform API and third-party access
- Auth routes for register/login/logout and current-user lookup.
- Tenant context comes from authentication, never from a client-supplied company ID.
- Endpoint-level permission enforcement.
- Versioned endpoints for products, orders, tasks, messages, events and audit.
- Tenant-bound API keys, hashed storage, per-key permissions and request-rate limits.
- Owner/admin key creation and revocation.
- External requests inherit the key's tenant.

### Import / migration center
- CSV parser with quoted-field handling.
- XML item import contract.
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
- Avito has a real messenger adapter using the verified token endpoint and messenger API paths.
- Avito adapter supports token caching/refresh, chat listing, message reading, polling and text-message sending.
- Channel connection check performs a real Avito API call and records success/error state.
- VK, Youla, Drom, Farpost, Auto.ru and Zzap remain explicitly unconfigured until official endpoints/credentials are verified.

### Secure channel configuration
- Per-company channel connection records.
- AES-256-GCM encryption for external channel credentials using `EINEIRO_SECRET_KEY`.
- Stored credentials are never returned by list/read endpoints.
- Connection state tracks configured/enabled/status/last check/last success/last error.
- Protected routes for listing, saving, disabling and checking channel connections.

### Marketplace transactions, payments and logistics
- Tenant-scoped orders and normalized items/totals.
- Order lifecycle: created -> accepted -> packing -> shipped -> delivered / returned / cancelled.
- Illegal transition protection.
- Provider-neutral payment registry with idempotent creation, synchronization and refunds.
- Provider-neutral logistics registry with shipment creation, tracking, history and cancellation.

### Reliability and background work
- Persistent job queue stored in the main data store; unfinished jobs survive server restarts.
- Typed handlers with delayed execution, retry/backoff, max-attempt failure handling and idempotency keys.
- Background runtime starts with the server and runs automatically without user login.
- Default backup schedule is twice monthly (1st and 15th at 03:00 UTC) per company.
- File-storage backups with metadata, retention pruning and restore.
- PostgreSQL full-platform backups use native `pg_dump`, integrity listing via `pg_restore --list` and restore via `pg_restore`.
- Isolated per-company backups export users, tenant records, audit and events with SHA-256 integrity verification and targeted restore.
- Metrics registry, health registry and protected reliability endpoints are restored.

## Still pending for true production operation
- Pixel-level redaction for faces/license plates before external AI calls.
- Live verification using real Avito credentials on the deployment host; the adapter and verified contract are implemented.
- Verified real adapters and credentials/webhooks for VK, Youla, Drom, Farpost, Auto.ru and Zzap.
- Production acquiring-provider credentials and webhook wiring.
- Production transport-company credentials/API wiring.
- OAuth authorization flow for third-party integrations; scoped API keys already exist.
- External queue backend for multi-server horizontal scaling; persistent single-database queue exists.
- External metrics/log storage and alert delivery.
- Off-host backup replication and automated disaster-recovery drills; local PostgreSQL and per-company backup/verification exist.
- Production-scale external search index when in-process Product Graph search no longer meets load requirements.
- Mobile application packaging and store publication pipeline.
- Full production runtime verification of the newest canonical Business/Admin surfaces on the deployment host.

## Rule for future work
- `EINEIRO_CANONICAL.md` is the product authority.
- No chat statement counts as implementation. Every completed feature must have a Git commit.
- Every production-critical feature also requires tests or runtime verification before being marked production-ready.
- Do not resurrect old EP Base behavior into the universal product unless it is intentionally isolated as a domain module.
