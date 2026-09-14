# EINEIRO Security P0-A — implementation report

**Date:** 2026-09-14  
**Baseline:** `352d5d8a76cbdf97b5da821aee731798cbb924b7`  
**Specification:** EINEIRO SECURITY MAXIMUM v1

## GAP LIST before changes

1. Seller/warehouse could request the complete Business snapshot, including finance, payments, AI costs and internal exceptions.
2. Raw session bearer tokens were stored as database keys and values.
3. Login had no active brute-force protection.
4. Browser logout accepted cross-site requests without CSRF validation.
5. Public Vision Search had no request, daily or global AI budget limit and no independent kill switch.
6. Three API modules read request bodies without a byte limit; other modules duplicated inconsistent JSON parsing.
7. HTTP responses lacked a platform-wide CSP, clickjacking protection and Permissions Policy.
8. PostgreSQL TLS explicitly disabled certificate verification.
9. Secret/key file patterns were not covered by `.gitignore`.
10. CI had no dependency lockfile, SCA/SBOM, dedicated security regression job or CodeQL gate, and actions used mutable version tags.

## Threats covered

- Broken access control and disclosure of owner-only business data.
- Offline theft and replay of session tokens from a copied database.
- Basic credential stuffing and brute-force attempts.
- CSRF logout.
- AI wallet exhaustion and uncontrolled Vision endpoint abuse.
- Oversized/deep JSON memory abuse and prototype-key payloads.
- Clickjacking and common browser content-injection impact.
- Database man-in-the-middle caused by unverified TLS.
- Accidental secret commits and obvious secret material.
- Silent security regression in pull requests.

## Implementation

- Business API now denies all roles except `owner` and `manager`.
- Session tokens are 256-bit random values; only SHA-256 token hashes are persisted.
- Session absolute TTL is eight hours; idle TTL is thirty minutes; activity touch is throttled.
- Login failure windows enforce identity and IP limits with `429 LOGIN_RATE_LIMITED`.
- HTTP login and registration have additional endpoint limits.
- Browser logout requires the double-submit CSRF token when a session cookie exists.
- Vision Search has per-minute, per-day and global limits, frame limits, body complexity limits and `VISION_KILL_SWITCH`.
- All JSON-reading API handlers use the shared bounded parser.
- Static and API responses receive CSP, frame denial, MIME sniffing protection, COOP/CORP, Referrer Policy and Permissions Policy. HSTS is added in production.
- Production PostgreSQL refuses startup without `DATABASE_SSL=true`; TLS verifies the certificate and accepts an explicit trusted CA.
- Secret/key patterns are ignored and scanned.
- A dependency lockfile, blocking high-severity npm audit, CycloneDX SBOM, security regression tests and CodeQL run in CI. Third-party actions are pinned to immutable commit SHAs.

## Environment controls

No secret values are committed.

- `TRUST_PROXY=true` only behind a trusted proxy that overwrites `X-Forwarded-For`.
- `LOGIN_RATE_LIMIT_PER_MINUTE` default: 20.
- `REGISTER_RATE_LIMIT_PER_HOUR` default: 10.
- `VISION_RATE_LIMIT_PER_MINUTE` default: 6.
- `VISION_RATE_LIMIT_PER_DAY` default: 100.
- `VISION_GLOBAL_RATE_LIMIT_PER_MINUTE` default: 120.
- `VISION_MAX_BODY_BYTES` default: 6,000,000.
- `VISION_KILL_SWITCH=true` immediately disables public Vision processing.
- `EINEIRO_HTTP_MAX_BODY_BYTES` default: 14,000,000.
- `EINEIRO_HTTP_REQUEST_TIMEOUT_MS` default: 30,000.
- `DATABASE_SSL=true` is mandatory in production.
- `DATABASE_SSL_CA` contains the trusted database CA when the platform CA bundle is insufficient.

## Acceptance evidence

- Negative role tests prove seller and warehouse receive `403` while owner/manager remain allowed.
- Auth tests prove raw session tokens are absent from storage and revoked by raw-token logout.
- Auth tests prove lockout threshold and expiry.
- Parser tests prove byte, depth and unsafe-key rejection.
- Header tests prove CSP, frame denial and MIME protection.
- Static security scan rejects private-key material, OpenAI-like secrets, tracked secret files and disabled TLS verification.
- Full `npm run check`, `npm run security:check` and `npm run build` pass locally.
- Locked production dependency audit reports zero known vulnerabilities at implementation time.
- Remote CI evidence is recorded in the draft PR after the branch update.

## Remaining risks

This slice does not claim completion of SECURITY MAXIMUM:

- rate limits are process-local until the P0-B distributed store is introduced;
- FIDO2/passkeys, Root Break Glass and owner recovery are P0-B;
- PostgreSQL RLS and separate DB identities are P0-B;
- WAF, DDoS protection, origin shielding and Admin Zero Trust Access require the target infrastructure;
- complete encrypted immutable off-site backup remains P0-B;
- signed artifact provenance and broader non-npm supply-chain attestation remain open;
- independent pentest, DAST/fuzzing and AI red-team remain P0-C.

## Rollback

Revert the Security P0-A commit as a single unit before deployment. Session hashing intentionally invalidates sessions created by the previous build, so deployment requires a planned one-time user re-login. Do not restore compatibility with raw database session tokens.

## Owner actions

No secret needs to be sent in chat. Before a production deployment, the owner must configure the trusted database CA and infrastructure gates described above; until then the PR stays draft.
