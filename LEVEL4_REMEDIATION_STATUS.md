# EINEIRO Level 4 Hard Audit — Remediation Status

Status: **IN PROGRESS / FREEZE BLOCKED**

This branch executes `EINEIRO_Level_4_Hard_Audit_Remediation_TZ_v1.md`.

## Closed or materially remediated in this branch

- public self-registration privilege escalation blocked;
- generic raw entity write API disabled;
- broken connector bridge check path restored;
- Privacy Gateway contract unified with AI Provider Layer;
- Category Schema expanded to the canonical 16-block contract;
- Condition Engine introduced;
- Product / Offer / SKU commercial boundary tightened;
- Price Lab moved from Product price mutation to Offer price mutation;
- Auto Parts domain data moved to AutoPartProfile;
- Universal Import aligned with Schema / Moderation / Condition and row idempotency;
- Event Layer upgraded with versioned envelope, idempotency, retry, DLQ, audit and replay foundation;
- Policy decisions persisted for observability;
- file and PostgreSQL exports merge UnifiedAudit / PlatformEvent into canonical views;
- Observability aligned with canonical provider, policy and event entities;
- Market runtime moved from demo ProductGraph to cross-tenant Product / Offer search;
- Vision runtime routed through AI Provider Layer + Privacy Gateway;
- Unified Inbox routed through Connector Framework;
- Level 4 CI workflow added.

## Still blocks Freeze

- prove full `npm run check` in CI and repair every failing regression;
- finish platform-admin / MFA / secret-vault / webhook-security hardening;
- remove remaining legacy direct role checks and move human/API authorization to Policy/Capability path;
- move remaining AI contour side effects through Decision + Policy + Audit;
- complete async queue migration for Vision/import/indexing/AI/connector sync/marketing workloads;
- complete Category Builder UI/API;
- complete live multi-provider AI verification without falsely marking raw media as de-identified;
- verify multiple real external connectors;
- execute production-like PostgreSQL backup restore rehearsal with RPO/RTO evidence;
- complete full commerce E2E and Spatial/WP-13B device acceptance;
- complete multi-category pilot Wave 1, remediation, Wave 2 and Core Escape Rate audit.

No Architecture v1 Freeze may be declared while any blocker above remains.
