# Current EINEIRO storage contracts

Inspected 2026-10-19. Re-read the actual source before any migration; this describes
the current working tree, not a guarantee about future releases.

| Source | Observed behavior | Consequence |
|---|---|---|
| [storage.mjs](../../../../server/storage.mjs) | JSON schema version 2; `JsonFileStore.init()` migrates and flushes immediately | Do not use initialization for a read-only target check; preserve the original file first |
| [postgres-storage.mjs](../../../../server/postgres-storage.mjs) | PostgreSQL schema version 1; `PostgresStore.init()` calls migration; factory defaults to `DATABASE_URL` | Identify the target before initialization; always use an explicit isolated target |
| PostgreSQL migration helper | Uses `pool.query` for BEGIN, statements and COMMIT | A real pool can switch clients; verify/fix transaction affinity before relying on rollback. Mock-pool tests do not establish it |
| [infra.mjs](../../../../server/infra.mjs) | Full JSON backup/restore copies a file; restore overwrites `dataFile` | Establish snapshot consistency and restore only to a separate, explicit destination during rehearsal |
| [postgres-backup.mjs](../../../../server/postgres-backup.mjs) | `verify()` runs `pg_restore --list`; restore defaults to the source connection; connection arguments may contain credentials | Archive listing is not a restore drill. Do not invoke this wrapper against live targets or secret-bearing DSNs during setup; a future live run needs reviewed explicit-target and credential-safe execution |
| [company-backup.mjs](../../../../server/company-backup.mjs) | Exports users, typed records, audit and events; restore upserts records and appends logs | Not an exact full DB replacement; sessions/schema and unrelated state are outside this export. Repeated restoration can append duplicate logs |
| [disaster-recovery.mjs](../../../../server/disaster-recovery.mjs) | `verifyLatest()` uses optional `dryRunRestore`; both integrity and restore evidence are needed for `verified` | A stored status is not proof of a restore; inspect the actual backend and evidence |
| [http-api.mjs](../../../../server/http-api.mjs) | PostgreSQL platform backup/restore is delegated to infrastructure | Do not assume the platform JSON endpoint backs up PostgreSQL |

Existing JSON and mock PostgreSQL tests are useful regression checks. They do not prove a
real PostgreSQL restore, concurrency, transaction behavior or production readiness.

## Review cases

- Ambient `DATABASE_URL` points at an unknown target: stay in PLAN ONLY, do not initialize it.
- A backup passes checksum/listing but has never restored: stop at restoration proof.
- A company export is offered as full rollback: reject that scope assumption.
- Row counts match but organization IDs changed: data validation fails.
- A migration succeeded but rollback lost records: block target execution.
- A writer was already paused before this run: preserve that pause after completion.
- A final smoke check fails: retain necessary protective pauses and report the failure.
- A local JSON rehearsal passes: report JSON-only evidence, not PostgreSQL/live readiness.

These cases are review criteria for the skill, not claims of completed live tests.
