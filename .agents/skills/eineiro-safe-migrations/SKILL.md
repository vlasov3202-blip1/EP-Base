---
name: eineiro-safe-migrations
description: "Use for EINEIRO database schema/data migrations, storage changes, backup/restore rehearsals and rollback planning. Verify the target, prove a backup restores, rehearse in isolation, validate tenant data, prove rollback, then verify and release only this run's pauses. Default to planning when target or authority is unknown."
metadata:
  version: "1.0.0"
  author: EINEIRO
---

# EINEIRO safe migrations

Use this workflow for changes to stored data or schema, moving storage, backfills and
restore/rollback operations. It complements the current Spec Kit feature; it does not
create a second requirements process or authorize access to an environment.

Read the repository `AGENTS.md`, `.specify/memory/constitution.md`, the active feature's
`spec.md` / `plan.md` / `tasks.md`, and this skill's
[storage contracts](references/storage-contracts.md). Record evidence in a copy of
[the run template](templates/MIGRATION_RUN.md) within the active feature directory.
Use sanitized identifiers, checksums, counts and report paths; never store credentials,
connection strings, personal data, database dumps or authentication state in Git.

## Scope and hard stops

- Start in **PLAN ONLY** unless a particular environment and operation are already
  authorized. A skill invocation alone is not permission to migrate a live database.
- For an installation/review task forbidding live access, use only newly created synthetic
  fixtures. Do not read live DBs, existing backups, secrets, `.env` files or ad accounts.
- An unknown target, failed restore, mixed tenant data, unproven rollback, or unexpected
  schema is a **BLOCKED** gate. Continue independent planning; do not advance dependent writes.
- Use explicit paths/connections. Never inherit a database target from ambient
  `DATABASE_URL`, `PG*`, default constructors or the working directory.
- `localhost` does not prove isolation: it may be a tunnel to a live system.
- Do not start the application or initialize a store just to identify its schema:
  current EINEIRO store initialization can migrate and write immediately.
- Preserve working data and other people's changes. Do not use a generic cleanup command,
  `DROP`, `--clean`, production restore or unpause operation to make a rehearsal pass.
- Live execution is a separate operation after the rehearsal and within the user's
  explicit scope. Prepare a reviewable plan and evidence before any required authorization.

## 1. Verify the target database

Record the intended environment, storage engine, database/cluster/schema identifier,
expected current and target versions, tenant scope, release and migration checksum.
For JSON record an explicit canonical file path; for PostgreSQL record non-secret identity
separately from the credential mechanism. Resolve symlinks and confirm the destination is
distinct from every source and existing backup. Fail on ambiguity or a version mismatch.

For an authorized connection, confirm actual server/database identity and schema version
using read-only metadata queries on an explicit connection. Compare them with the run
record. If access is not authorized, mark this gate pending without opening a connection.

Identify all writers: application processes, workers, scheduled jobs, imports, webhooks,
integrations and autonomous agents. Establish a consistent snapshot method. When a pause
is necessary, record each control's prior value, owner, scope and the exact resume condition.
Pause only authorized writers and drain in-flight writes. UI hiding is not a write barrier.
Draft recovery triggers and a rollback approach before the first mutation; prove them at
step 5. No production pauses are needed for a synthetic local rehearsal.

## 2. Back up and prove restoration

Create a consistent full backup appropriate to the operation. Record source identity,
schema/application versions, tool versions, timestamp, artifact size and SHA-256, retention
and protected storage location. Preserve the last known good backup through final validation.
Document coverage of users, sessions, tenant records, audit/events, sequences, roles,
extensions and external assets; explicitly identify items needing separate backup.

A company export is not a full platform backup. An archive listing or matching checksum
proves readability/integrity, not recoverability. Restore the backup into a **fresh isolated
target**, verify schema and representative reads plus tenant/entity counts, and record the
results. Ensure application hooks cannot auto-migrate the restored pre-migration data before
the baseline is measured. Disable external sends, schedulers and payments on the rehearsal
target. Keep failures and artifacts available for diagnosis rather than replacing evidence.

Do not continue to step 3 without a successful restore test of this exact backup.

## 3. Migrate on an isolated stand

Apply the exact migration/release candidate to a separately identified restored clone.
Reconfirm the target immediately before execution. Use synthetic fixtures for local-only
tasks; a live snapshot needs separate authorization, masking and access controls.

Record duration, locks, resource use, affected records, schema version and migration IDs.
For PostgreSQL confirm transaction affinity: all statements of a transaction must use the
same checked-out client. DDL without transactional support and backfills need explicit
restart/checkpoint procedures. Avoid concurrent migration runners.

Check retry behavior: repeat only migrations declared idempotent; otherwise verify their
version/checkpoint guard or expected refusal on a disposable copy. Test interrupted/error
paths when relevant. A failure must leave a known state with writes paused as required.
Use `systematic-debugging` for failures and `test-driven-development` for implementation fixes.

## 4. Validate data and behavior

Compare the restored baseline and migrated result against the feature's explicit invariants:

- schema versions and migration ledger match the candidate;
- counts and identifiers agree per organization and entity, with justified intended deltas;
- Product, Offer, SKU and Inventory relationships and monetary/quantity totals remain valid;
- tenant boundaries, platform/company roles, uniqueness and reference integrity hold;
- users, sessions, audit and events follow the documented preservation/invalidation policy;
- encoding, timestamps, nulls, large IDs and legacy formats retain their intended meaning;
- affected API reads/writes and negative authorization cases pass on the isolated target.

Read actual records, not only aggregate counts or seeded UI values. Reconcile every
unexpected delta. Treat missing coverage as pending, never as a successful check.

## 5. Prove the rollback plan

Finalize the rollback record: triggers and decision owner; exact application/schema pair;
backup identity and verified restore procedure; permitted downtime and data-loss window;
handling of writes after the snapshot; sequence/checkpoint reconciliation; and verification
commands. A code revert alone does not undo a data migration.

Rehearse the selected recovery method on a disposable target and validate data again.
Use a down migration only when it is proven to preserve required data. Otherwise plan a
restore or forward recovery with its impact stated. Do not overwrite newer writes or merge
company exports into a populated database as an assumed exact rollback.

Without a proven recovery method, report **BLOCKED FOR TARGET EXECUTION**. Keep authorized
non-mutating work moving. The runbook remains ready for review; no live execution is implied.

## 6. Final checks and controlled release of pauses

For implementation changes run the applicable project checks in `AGENTS.md`, using isolated
test data. Verify the target version, data invariants, affected permissions and smoke flows.
Report actual results and limitations with `verification-before-completion`.

Only after these gates pass, restore controls **owned by this run** to their recorded prior
values, in the planned order. Preserve pre-existing incident pauses, other operators' locks,
Silent Run flags, disabled seller advertising and disabled payments. Confirm the resumed
writers work and do not create duplicates, stale writes or a growing error/queue backlog.

If validation fails, retain the necessary protective pauses and report their owners and next
actions; never unconditionally resume in `finally`. For a local rehearsal, verify only its
own temporary resources and state; production controls remain untouched.

## Required report and Spec Kit handoff

For each gate report **PASS / FAIL / PENDING / NOT APPLICABLE**, supporting evidence and scope.
Distinguish a completed synthetic rehearsal, a proved staging migration and a live migration.
Never label a real target ready based only on mocks, a local JSON rehearsal or a green task box.

Add migration, restoration, rollback and resume tasks to the existing feature `tasks.md`.
Use `speckit-analyze` for plan consistency and `speckit-converge` after implementation.
Update the feature's run record when the migration checksum, target or assumptions change;
prior evidence is not transferable to a different migration or database.
