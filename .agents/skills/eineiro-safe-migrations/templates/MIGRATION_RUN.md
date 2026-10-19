# EINEIRO migration run record

Status: PLAN ONLY
Feature/spec:
Run ID / date / operator:
Authorized scope and evidence:
Explicitly excluded targets/actions:

## Target and candidate

Environment and engine:
Sanitized target identity (never a credential-bearing URI):
Source / restored baseline / migration clone / rollback clone identities:
Current schema -> target schema:
Application revision / migration checksum:
Organization/entity scope:
Metadata verification evidence:

## Consistency and pause ledger

Snapshot consistency method / in-flight write handling:
Preliminary recovery triggers before the first mutation:

| Control / owner | Prior value | This run changed it? | Reason | Resume condition | Final value / evidence |
|---|---|---|---|---|---|

## Backup and restoration evidence

Backup ID / protected artifact path / SHA-256 / size / timestamp:
Source schema/application/tool versions:
Covered data / separately backed up assets / exclusions:
Retention and access policy:
Explicit isolated restore target:
Restoration command reference (sanitized) / exit code / duration:
Schema, tenant/entity counts and representative reads:

## Isolated migration and validation

Exact candidate / execution evidence / duration:
Transaction or restart/checkpoint method:
Retry / interrupted execution evidence:
Expected data changes:
Observed counts, key relationships and tenant isolation:
API/permission checks and unexpected differences:

## Rollback and rehearsal

Trigger / decision owner:
Known good application and schema pair:
Recovery method / exact backup:
Permitted downtime and data-loss window:
Writes after snapshot / reconciliation method:
Rollback clone and verification evidence:

## Final checks and resumption

Commands, exit codes, scope and report paths:
Only this run's pauses restored / previously paused controls preserved:
Queue/backlog, errors and duplicate-write observation:
Temporary resources retained or removed, and why:

## Gate summary

| Gate | PASS / FAIL / PENDING / NOT APPLICABLE | Evidence / reason |
|---|---|---|
| Target verified | PENDING | |
| Backup and actual restoration proved | PENDING | |
| Isolated migration | PENDING | |
| Data and behavior validation | PENDING | |
| Rollback proved | PENDING | |
| Final checks | PENDING | |
| Controlled resumption | PENDING | |

Conclusion and exact tested environment:
Outstanding risks / blocked actions / owners:
Local changes vs commits, publication and live operations:
