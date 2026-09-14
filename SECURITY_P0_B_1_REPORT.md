# EINEIRO Security P0-B/1 — distributed controls and audit integrity

**Date:** 2026-09-14  
**Parent security slice:** P0-A  
**Specification:** EINEIRO SECURITY MAXIMUM v1

## Delivered in code

1. PostgreSQL-backed fixed-window limits use an atomic upsert, so login, registration, Vision and API-key budgets are shared between application replicas.
2. Rate-limit subjects are HMAC-SHA-256 pseudonymized before storage when the production hash key is configured. Raw client IP addresses and API-key identifiers are not stored in the limiter table.
3. A database failure produces `503 RATE_LIMIT_BACKEND_UNAVAILABLE`; protected endpoints do not silently fall back when the distributed backend is selected.
4. `EINEIRO_DISTRIBUTED_RATE_LIMIT_REQUIRED=true` prevents startup with the local in-memory limiter.
5. PostgreSQL schema v2 enables RLS on tenant tables and creates policies bound to `eineiro.company_id`.
6. Every tenant repository operation opens a transaction and installs the tenant context with transaction-local `set_config` before reading or writing.
7. `DATABASE_RLS_REQUIRED=true` requires a separate `DATABASE_TENANT_URL`; using the privileged system identity as the tenant identity is rejected.
8. Unified Audit records have a sequence, previous hash and event hash. With `EINEIRO_AUDIT_INTEGRITY_KEY`, the chain uses HMAC-SHA-256.
9. Audit verification reports sequence gaps, previous-hash mismatches and event-content tampering.
10. Sensitive audit actions create SecurityAlert records. Control Plane exposes owner/admin integrity status and alerts.
11. Role invitations, API-key changes and backup/restore require a recent explicit password re-authentication with a short TTL; the final ROOT implementation still requires FIDO2.

## Fail-closed production controls

Before controlled Silent Run set:

- `DATABASE_URL` to the privileged migration/system identity;
- `DATABASE_TENANT_URL` to a separate non-owner application identity subject to RLS;
- `DATABASE_RLS_REQUIRED=true`;
- `EINEIRO_DISTRIBUTED_RATE_LIMIT_REQUIRED=true`;
- `EINEIRO_RATE_LIMIT_HASH_KEY` with at least 32 random bytes from Vault/KMS;
- `EINEIRO_AUDIT_INTEGRITY_KEY` from Vault/KMS, not from source control;
- `EINEIRO_AUDIT_INTEGRITY_REQUIRED=true`.

No value for these secrets belongs in chat, Git, an image or a ticket.

## Acceptance evidence

- distributed limits reject over-budget requests and reset in a new window;
- stored limiter keys do not contain raw IP addresses;
- backend failure is rejected with 503;
- PostgreSQL migrations contain RLS policies and a shared limiter table;
- tenant writes override hostile payload `companyId` values with the authenticated tenant;
- every tenant CRUD path establishes a transaction-local DB tenant context;
- audit verification detects altered records;
- a missing HMAC key is rejected when integrity is mandatory;
- high/critical actions create security alerts.

## Still not complete

This is P0-B/1, not the full Maximum Security finish. The following remain blocked on owner/infrastructure work or later implementation:

- WebAuthn/FIDO2 enrollment and two hardware keys for `ROOT_BREAK_GLASS`;
- passkey-based `OWNER_DAILY` and step-up re-authentication on every critical action;
- creation and grants for the real PostgreSQL system and tenant roles;
- centralized immutable external Audit/WORM export and owner alert delivery;
- WAF, DDoS protection, origin shielding and Admin Zero Trust Access;
- encrypted immutable off-site backup with independent restore drill;
- independent pentest, DAST/fuzzing, AI red-team and retest.

The pull request must remain draft and must not be deployed until the fail-closed variables and database identities are configured and tested in staging.
