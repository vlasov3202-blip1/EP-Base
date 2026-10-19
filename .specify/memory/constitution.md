# EINEIRO Constitution

## Core Principles

### I. Product authority

The current user brief defines the authorized change. Product requirements MUST follow
`EINEIRO_CANONICAL.md` and the accepted
`EINEIRO_SILENT_RUN_PLATFORM_ACQUISITION_ADDENDUM.md`; the addendum narrows the earlier
marketing and paid-placement rules while Silent Run applies. A feature spec MUST reference
these sources and preserve their constraints unless the user explicitly changes them.
Generic skills, historical EP Base behavior and seeded UI values MUST NOT establish new
product mechanics. This constitution records existing decisions, not a competing product spec.

### II. Application boundaries

EINEIRO MUST retain separate Market, Business and Admin surfaces. Universal Core MUST keep
Product, Offer, SKU and Inventory distinct. Automotive-specific behavior belongs in
`server/auto-domain.mjs` and domain UI. Server operations MUST enforce organization isolation
and the distinction between company permissions and platform authority; hiding a control
does not enforce authorization. Changes MUST preserve existing routes and contracts unless
their migration is part of the authorized feature.

### III. Usable surfaces

Market MUST preserve the Camera Safe Zone, one selected Offer per scene object, independent
object catalogs and replacement at the existing spatial anchor. Business and Admin MUST
prioritize operational tasks and exceptions without decorative delays. Changed interfaces
MUST support keyboard navigation, visible focus, reduced motion and useful loading, empty
and error states. Phone, tablet and desktop layouts MUST be checked with realistic Russian
text when affected. Design skills guide execution within these product constraints.

### IV. Silent Run acquisition

Sale commission MUST remain 0%. In the accepted Silent Run model, paid acquisition promotes
EINEIRO using the platform budget and only the permitted application, camera, category or
scene destinations. Seller advertising accounts, seller campaigns, paid Showcase and
promotion of specific sellers or offers with platform funds MUST remain disabled.
Organic relevance MUST be independent of advertising spend. Future acquisition changes
MUST preserve the addendum's authorization, budget limits, stop controls, audit and data
minimization rules. Disabling Silent Run alone MUST NOT enable seller advertising.

### V. Evidence of completion

Completion claims MUST reference observed behavior and relevant acceptance checks.
Mocks, demo data, task checkboxes and static review MUST NOT be reported as successful live
provider integrations. Tests MUST use isolated temporary data, never production databases.
Secrets MUST NOT be committed or printed. Reports MUST distinguish local edits, executed
checks, commits, publication and actual provider/device verification.

## Scope and compatibility

Use the existing vanilla JavaScript ES modules, CSS and Node.js 22+ stack. Reuse current
services and contracts. New frameworks or dependencies require a concrete feature need,
not a template example. Work in the existing checkout and preserve unrelated changes and
working data. Create worktrees only when requested.

Establish the measured baseline from the current checkout and fresh checks. Dated reports
may describe uncommitted working-tree changes. Read `AGENTS.md` for development conventions
and the relevant installed design skill for design work.

## Development workflow and verification

Apply Spec Kit to the next substantial mechanic or cross-cutting change. A bounded feature
MUST record user scenarios, roles, states, error paths, acceptance criteria and exclusions in
`specs/<number>-<feature>/spec.md`; `plan.md` connects them to the existing architecture and
`tasks.md` tracks implementation and checks. Ask only for unresolved product decisions that
materially affect the work. Routine edits do not require the full specification workflow.

Use specify, plan and tasks, then analyze their consistency before implementation. Clarify
uncertain requirements when necessary. After implementation, converge checks code against
the artifacts; its findings MUST be supported by source or execution evidence. Update the
feature artifacts when an authorized requirement changes so they remain a coherent contract.

Plan validation appropriate to the change and check the actual package scripts first.
Application changes need code checks; runtime changes need a build and isolated smoke tests;
frontend behavior needs browser checks. Do not assume that helpers in an earlier working
tree are present in this commit. For changed authorization, state or data contracts,
include meaningful success and failure scenarios. Documentation and skill
installation changes need structural and integrity checks rather than unrelated runtime tests.
Real camera/AR hardware, PostgreSQL and external services require their own explicit evidence.

## Governance

This initial constitution adopts existing project decisions under the user's instruction to
add Spec Kit. Future amendments MUST cite the changed user requirement or authoritative
project document, update affected active feature artifacts and explain the impact.
Version changes use MAJOR for incompatible principle changes, MINOR for new or expanded
principles, and PATCH for wording clarifications. Every feature plan and final review MUST
check the applicable principles. Preserve source templates and upstream skills; project rules
belong here and in project documents. Report unresolved conflicts rather than inventing rules.

**Version**: 1.0.0 | **Ratified**: 2026-10-19 | **Last Amended**: 2026-10-19
