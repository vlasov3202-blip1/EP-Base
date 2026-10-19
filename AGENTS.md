# EINEIRO development

- The product is EINEIRO. `EP-Base` is the historical repository/directory name. Follow `EINEIRO_CANONICAL.md`, then the accepted Silent Run addendum and the current user brief. Automotive behavior belongs in `server/auto-domain.mjs` and domain-specific UI, not Universal Core.
- Establish the baseline from the current checkout and fresh checks. If `docs/DEVELOPMENT_STATUS.md` exists, treat it as a dated report of its working tree, not proof that those changes are committed. Do not treat recovery/audit documents or seeded UI values as proof of production readiness.
- This is an existing vanilla JavaScript ES-module/CSS application with Market, Business and Admin surfaces. Preserve working routes, data contracts and the current stack. Product mechanics will be specified by the user; do not infer new ones from generic design advice.
- Use the existing isolated checkout. Do not create a Git worktree unless requested. Preserve user changes and working data. Source changes are authorized by coding tasks; setup-only work should leave tracked application files unchanged.
- Check the actual `package.json` before choosing application commands; development changes and their lockfile may be uncommitted. Use `npm ci` only when an installation is requested and a lockfile exists. Validate application changes with the checkout's check/build commands and relevant isolated runtime/browser checks when available. Never point tests at a production database or print credentials. Skill setup uses `bash scripts/cloud-skills-setup.sh` without npm, network or databases; do not reinstall packages to load the vendored instructions.
- Report local edits, commits, remote publication and live provider verification separately. Do not claim deployment or a committed feature without evidence.

## Feature specifications

- Spec Kit 1.2.2 is installed for Codex in `.agents/skills/speckit-*/`. Read `.specify/memory/constitution.md` and the skill for the current step before applying it. See `docs/SPEC_KIT.md` for the workflow and pinned source.
- Starting with the next substantial mechanic, use a bounded `specs/<number>-<feature>/` with `spec.md`, `plan.md` and `tasks.md`. Preserve the existing architecture and reference authoritative product documents. Use clarify for unresolved requirements, analyze before implementation and converge afterward; code review and actual checks remain necessary.
- Small fixes and visual adjustments do not require a full Spec Kit cycle. Continue already authorized work without asking for repeat approval. Completed feature specs remain living contracts: reconcile them with authorized subsequent changes and retain history in Git.
- Core Git extensions and runtime event hooks are not enabled. Use the current checkout; do not publish issues or run external actions merely because a skill offers them. In this cloud environment the optional CLI is `/workspace/.tools/bin/specify`; core Bash scripts are vendored in `.specify/scripts/bash/`.

## Design work

Read the matching installed skill before applying it:

- `.agents/skills/impeccable/SKILL.md`: UX hierarchy, accessibility, responsive behavior, audits and polish.
- `.agents/skills/design-taste-frontend/SKILL.md`: visual direction and composition. For Business/Admin, follow its app-screen guidance rather than marketing-page layouts.
- `.agents/skills/emil-design-eng/SKILL.md`: purposeful animation, interaction feedback, timing, performance and reduced motion.

The skill base directory is the directory containing its SKILL.md. Upstream files and licenses are vendored unchanged; provenance and hashes are in `docs/design-skills-lock.json`. Do not run installation or a redesign merely because a skill exists. Choose guidance relevant to the user’s task and preserve the product constraints below. User instructions and product truth take precedence over generic style preferences.

For Impeccable use `IMPECCABLE_HOME=/workspace/.cache/impeccable` in the cloud workspace, or another writable cache directory elsewhere. The launcher verifies its downloaded engine checksum. Set `IMPECCABLE_NO_TELEMETRY=1` for project work. No project hooks are installed. When a skill requires unavailable tools or assets, state the actual limitation and continue its supported fallback.

- Keep Market camera safe zone unobstructed. One selected Offer per scene object, independent catalogs and replace-in-place anchors must survive visual changes.
- Business/Admin prioritize quick task completion and exceptions. Do not introduce decorative delays for repeated operational actions.
- Honor reduced motion, keyboard access, clear focus, loading/empty/error states and Russian text of realistic length.
- Check actual rendered screens at phone, tablet and desktop sizes. HTTP checks alone do not prove visual correctness or device camera/AR support.

## Skill selection and precedence

- Start native Codex sessions with the repository as their working directory: `/workspace/EP-Base` in this cloud environment. A session started at `/workspace` does not discover skills in child repositories by walking its ancestors; a later shell `cd` does not prove the original session catalogue was reloaded. See `docs/CLOUD_SKILLS.md` for startup, a safe new-session task and the current service-profile blocker.
- Distinguish native discovery, explicit file reading and actual skill application. If the client does not expose a project skill in its catalogue, read its local `SKILL.md` for the authorized task and disclose that fallback. Do not claim that file integrity proves native loading, and do not copy skills into protected global directories, change HOME/CODEX_HOME, remount the service profile or relax permissions to conceal a loader failure.
- The complete installed inventory and pinned sources are in `docs/skills-lock.json`; usage and compatibility are in `docs/SKILLS.md`. Skills live directly under `.agents/skills/<name>/SKILL.md`. Read only skills needed for the current task and resolve references against their own directories.
- User scope and authoritative EINEIRO documents govern product decisions. Spec Kit manages requirements, plan and tasks. Domain skills guide execution within those decisions; they do not independently change the stack, create another planning workflow, or enable product features.
- Only three skills from `obra/superpowers` are installed: `systematic-debugging`, `test-driven-development`, `verification-before-completion`. Upstream references such as `superpowers:test-driven-development` map to the local `$test-driven-development`. Do not install or invoke the Superpowers bootstrap, whole plugin, hooks, brainstorming, worktree or delegation workflows through these references.
- Use systematic debugging for failures, meaningful red/green tests for behavior changes and verification before completion claims. Spec Kit tasks must include those checks where relevant. Preserve existing/user-written code: upstream advice to delete untested drafts never authorizes deleting prior work. Documentation, vendoring and routine configuration use proportionate integrity/discovery checks; they do not require redundant approval or artificial application tests.
- Migration, backfill and restore tasks use `$eineiro-safe-migrations` within the same Spec Kit feature. No target access is inferred from ambient variables. Verify the target, prove backup restoration, rehearse on an isolated stand, validate data, prove rollback, run final checks and restore only pauses owned by that run. Preserve pre-existing pauses and Silent Run flags. A setup-only task never authorizes live DB operations.
- Marketing starts from `PRODUCT.md`, the canonical documents and the Silent Run addendum. Skills do not establish audiences, budgets, business metrics or advertising rights. `ads`, `ad-creative`, `launch`, analytics tools and Sentry require a concrete task before external actions. Do not read secrets, connect accounts, publish content or spend money merely because their instructions offer that workflow.
- SEO concerns explicitly public pages. Business/Admin data remains protected by server authorization; robots/noindex is not access control. For UX accessibility/performance combine measured evidence with the existing design skills. Generic marketing/CRO patterns must not obstruct Camera Safe Zone or slow repeated Business/Admin actions.
- Some vendored skills link to optional skills outside the chosen set. Consult `docs/SKILLS.md` for known optional links; do not auto-install missing skills. Keep upstream files unchanged and record local adaptations in project rules.
- Sentry's copied upstream example uses its original monorepo path. Here run `.agents/skills/sentry/scripts/sentry_api.py` only for an authorized read-only Sentry task; installation checks may use `--help` without tokens or API calls.
- Playwright CLI is optional tooling at `/workspace/.tools/playwright/node_modules/.bin/playwright-cli` in this cloud workspace. Use a uniquely named session and temporary browser profile against local fixtures during setup. Do not attach to personal sessions or use `close-all`/`kill-all`. Set `NO_UPDATE_NOTIFIER=1` and use pinned installation instructions in `docs/SKILLS.md`.
