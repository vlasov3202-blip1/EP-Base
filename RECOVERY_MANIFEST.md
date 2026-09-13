# EINEIRO Recovery Manifest

This file is the source of truth after repository-history loss. A feature is considered restored only when code exists in Git; production claims require runtime/provider verification. The canonical product definition is `EINEIRO_CANONICAL.md` and overrides old EP Base behavior where they conflict.

## Product invariants
- EINEIRO is a universal commerce platform, not an auto-dismantling-only CRM.
- Marketplace sale commission is 0%. Monetization is through transparent subscriptions, services, promotion and logistics; mandatory external costs are itemized.
- Management by exceptions: routine work stays quiet; the owner sees only decisions requiring owner authority.
- AI acts only inside policy, confidence and permission limits and writes material actions to audit.
- Money cannot buy organic relevance or bypass quality/eligibility gates.
- Product, Offer, SKU and Inventory are separate layers.
- Market home has no ordinary product matrix before a user request.
- Limited Showcase Cards are allowed as commercial placement only after system eligibility; they do not replace organic relevance.
- Camera safe zone is immutable.
- Camera/voice is the primary Market request interface.
- A request is decomposed into independent scene slots; one requested object equals one placed object.
- Each slot has one current Offer plus its own full relevant catalog; no artificial total cap.
- Replace-in-place preserves anchor/context where valid.
- Clean View hides UI but keeps placed products.
- Phone, tablet and desktop layouts are adaptive, not scaled copies.
- Old EP Base automotive behavior belongs only to the automotive domain module.

## Restored in Git

### Canonical platform split
- `EINEIRO_CANONICAL.md` defines the current platform model.
- Business loads universal `eineiro-business.js`, not the old auto-dismantling UI.
- Automotive donor/OE/applicability/warranty logic is isolated in `server/auto-domain.mjs`.

### Universal commerce model
- Separate Product, Offer, SKU and Inventory layers.
- Offer owns seller-specific price, stock, condition, region, delivery, visual readiness and freshness.
- SKU owns variant attributes/barcode.
- Inventory is location-specific and tracks quantity, reservation and available stock.
- Organic Offer ranking applies hard eligibility before scoring.
- Hard eligibility includes active offer, stock, price, active seller, delivery, region, visual readiness and visual quality.
- Organic ranking factors: intent relevance, user relevance, visual quality, price relevance, delivery relevance, seller quality, freshness, behavior prediction and repetition penalty.
- Paid promotion weight is zero in organic ranking.

### Seller reputation and fair promotion
- Seller Score uses completed orders, cancellations, returns, disagreements, shipping SLA, response time, description accuracy, moderation issues and reviews.
- Product/Offer promotion eligibility is system-owned, not owner-selected.
- Low-quality offers are routed to improvement rather than paid amplification.
- AI Channel Allocator recommends external channels only after organic eligibility and only among live connected channels.
- Seller budget cannot override organic eligibility.

### EINEIRO Business / Adaptive Command Center
- Universal command center with operational main screen, sales, tasks, Price Lab, warehouse, products, analytics, finance, marketing, delivery, contours and integrations.
- AI Director, autonomy score, exception queue, AI Sales Control, dispatcher/tasks, Price Lab and Warehouse intelligence.
- Unified Inbox and Market orders.
- Start / Pilot / Autopilot and 7-day grace capability model.
- Contextual onboarding, owner-only decisions, 30-day forecast, external signals, morning report and main-screen personalization.
- Business snapshot receives server-side products, orders, tasks, payments, shipments, campaigns, finance and cross-contour operations state.

### Cross-contour operations brain
- Marketing -> Sales -> Stock -> Warehouse -> Order -> Payment -> Delivery -> Finance are analyzed as one causal chain.
- Routine remediation is separated from owner decisions.
- Cross-contour signals can produce automatic actions or owner exceptions based on severity/policy.

### AI Marketing Control
- Goal is profitable demand, not raw traffic.
- Campaigns include product selection, channels, audience, budgets and guardrails.
- Creative lifecycle includes generation, visual readiness, publishing, testing, winning/losing states and mutation of winners.
- Creative Factory separates copy generation from image/video generation and does not mark incomplete media as fully ready.
- Marketing tests collect impressions, clicks, leads, orders, revenue and spend.
- Weak variants can be paused automatically; winning variants can be scaled inside limits.
- New variants can be generated from winners.
- Marketing Publisher abstraction supports internal EINEIRO Market and future external channels.
- EINEIRO Market Showcase placements are read from live stored placements instead of only hard-coded cards.
- Marketing Memory stores prior experiments, audience/context, changed variables, control groups, results and lessons.
- Experiment planning supports explicit control share and single-variable tests.

### Finance Guard
- Finance is an economic limiter for other contours.
- Finance Guard can deny or require review for marketing/procurement based on cash reserve, budget share and margin floor.
- External/acquiring/logistics/returns/service costs remain itemized; sale commission remains 0%.

### Procurement and Unserved Demand
- Unserved Market requests are persisted instead of discarded.
- Demand signals carry strength based on saved intent, notify intent, willingness to wait, budget, preorder willingness and checkout attempt.
- Unserved Demand can be clustered for category growth, seller acquisition, procurement and marketing.
- AI Procurement creates proposals from demand/stock needs.
- Purchase Order creation requires fresh Finance + Warehouse + Policy approval and rechecks gates immediately before confirmation.

### Fulfillment / Partner-Operator First
- Operator, Location and ServiceOffer entities restored.
- Service types can cover Storage, Pickup, Packaging, Delivery, Inspection, Repair, Installation and future expert verification.
- Fulfillment selects dynamically by geography, category, capability, price, SLA, capacity/load, rating and policy context.
- EINEIRO is modeled as the orchestration layer rather than assuming ownership of every warehouse/point/logistics asset.

### Returns and Center for Disagreement Resolution
- Ordinary returns are separated from mismatch/damage cases.
- Disagreement stores buyer claim, seller response, evidence, AI analysis, proposed resolution, human review and final resolution.
- AI establishes facts/confidence and proposes fair resolution; it does not automatically assign blame.
- Ambiguous cases escalate to human review.

### Policy / Decision / Autonomy governance
- Policy Engine supports ALLOW, DENY, REQUIRE_APPROVAL and ALLOW_WITH_LIMIT.
- Policies can scope role/subject/action/resource/conditions/limits/priority/version.
- Risk classification uses amount, confidence, customer impact, affected count and external dependency.
- Decision Engine stores proposal, reason, policy, risk, status, expiry and execution result.
- Policy is rechecked immediately before execution.
- Rollback is also policy-gated.
- Owner-required decisions automatically produce exceptions.
- Autonomy Orchestrator composes Feature Flag -> Finance Guard -> Policy -> Decision before autonomous action.

### Feature Flags and rollout
- Feature flags support feature kind/key, tenant targeting, region targeting, category targeting and percentage rollout.
- Flags are deterministic per subject and allow internal -> pilot -> percentage/category/region -> all rollout without Core edits.

### Moderation Engine
- Moderation reads category policy/schema inputs for forbidden/restricted behavior, mandatory fields, documents, certificates and age constraints.
- Blocking issues create a moderation result instead of allowing the offer to proceed silently.

### AI operations / management by exceptions
- Employee-correction chain: warning -> hint -> task -> verification -> retraining -> owner escalation.
- Warehouse planning, forecast, morning report, AI Seller, AI costs and notification separation restored.

### Price Lab / Warehouse intelligence
- Server-side minimum/optimal price recommendations and guarded price changes.
- Warehouse prioritization, load-aware assignment, placement guidance and warehouse exceptions.

### Market / spatial search
- Camera-first request flow, voice context and short frame sampling.
- Vision -> structured intent -> Search -> Recommendation -> scene slots.
- Independent slot catalogs, pagination and replace-in-place.
- Product Graph relationship-aware ranking.
- Scene packs, category-specific scan patterns and device-specific layouts.
- Visual capability model includes standard media, 360, spatial/wall placement, body/face/vehicle try-on and measured 3D.
- Product visual pipeline tracks isolation/3D readiness and visual quality.
- Clean View and camera safe-zone invariants preserved.

### Product Graph / search / recommendation
- Hierarchical universal categories with category-specific attributes.
- Product/variant graph and typed relations.
- Exact/category/attribute/compatibility/semantic retrieval foundations.
- LLM structures intent but does not directly choose final product list.

### EINEIRO Admin / Control Plane
- Admin overview now uses live server data for companies, users, records, exceptions, notifications, AI cost and backups.
- Company health derives from stored exceptions/jobs rather than static demo values.
- Full Control Plane section model (Platform / Companies / Market / Categories / AI / Autonomy / Integrations / Moderation / Experiments / Feature Flags / Audit) remains the next UI/backend expansion.

### Security / identity / tenant isolation
- Server-side permissions and tenant-scoped data/event/audit.
- PBKDF2 password hashing, login/session/logout/expiry.
- Bearer sessions for integrations and browser HttpOnly cookie + CSRF transport.
- Same IDs are isolated by company.

### PostgreSQL / API / import / inbox / channels
- PostgreSQL storage and migrations.
- Tenant Platform API and scoped API keys.
- CSV/XML import foundation and reverse inventory.
- Unified Inbox with deduplication/idempotent outbound delivery/retry.
- Native EINEIRO Market adapter.
- Real Avito messenger adapter contract; live account verification still needs credentials.
- External channel credentials are encrypted per company.

### Payments / logistics / reliability
- Provider-neutral payments/refunds and shipment/tracking contracts.
- Persistent jobs, retries/backoff/idempotency.
- Background runtime and twice-monthly company backup schedule.
- PostgreSQL platform backup/verification/restore and isolated per-company backup/restore.
- Metrics and health foundations.

## Still pending for true production operation
- Full Control Plane sections and actions.
- Wire every autonomous contour to the common Autonomy Orchestrator rather than only providing the shared governance layer.
- Full Category Schema versioning and moderation policies across all categories.
- Production-ready Recommendation Engine separation and Offer-first Market rendering end-to-end.
- Production acquiring credentials/webhooks.
- Production fulfillment/logistics operator connectors and settlement.
- Real external channel publishing adapters beyond verified messenger capabilities.
- Pixel-level privacy redaction before external AI calls.
- OAuth flows for third-party integrations.
- External multi-server queue/metrics/log/alert infrastructure.
- Off-host backup replication and DR drills.
- Production-scale external search index when required.
- Mobile application packaging/store pipeline.
- Runtime verification of the newest canonical Business/Admin/Market on deployment host.

## Rule for future work
- `EINEIRO_CANONICAL.md` and accepted Library specifications are product authority; newer accepted decisions override older drafts.
- No chat statement counts as implementation. Every completed feature must have a Git commit.
- Production-critical features require tests or runtime verification.
- Do not resurrect old EP Base behavior into Universal Core unless intentionally isolated as a domain module.
