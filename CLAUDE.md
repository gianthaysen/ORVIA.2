# ORVIA — Claude Project Instructions

> Canonical repository-level instructions for Claude Code / Claude Cowork.  
> Place this file as `CLAUDE.md` in the repository root.  
> Version: 1.0  
> Last updated: 2026-06-27

---

## 0. Purpose of this file

This file defines how Claude must work on ORVIA.

It is not a product specification, a personal health profile, a task backlog, or a substitute for reading the code. It is a compact operating system for repository work:

- how to inspect the project,
- how to choose the correct source of truth,
- how to plan changes,
- how to use subagents efficiently,
- how to avoid token waste,
- how to test and verify,
- how to report honestly,
- how to protect user data and secrets,
- and how to keep ORVIA maintainable while it grows.

These rules apply to every repository task unless the user explicitly overrides one for a specific request.

---

# 1. Product context

ORVIA is a personalized multi-sport performance system.

The long-term product goal is to connect:

- athlete profile,
- primary, secondary, and occasional sports,
- sport-specific goals,
- schedule and fixed commitments,
- daily readiness and recovery,
- training load,
- symptoms and complaints,
- workouts,
- wearable data,
- nutrition,
- sleep,
- adaptive planning,
- coach workflows,
- and team workflows.

The product must eventually adapt both logic and interface to the individual user.

Core principle:

> ORVIA shows only what is relevant to the user, but it remains capable of recording and considering every supported activity.

Important distinction:

```text
enabled != visible != planningEnabled
```

- `enabled`: the sport or feature is available to the user.
- `visible`: the sport or feature is shown by default in the UI.
- `planningEnabled`: ORVIA actively plans for it.
- A hidden sport must still be recordable as an occasional activity.
- A sport that is not actively planned must not be treated as unavailable.

ORVIA is a performance and wellness product, not a medical device. It must not diagnose, treat, or claim medical certainty.

---

# 2. Current project state

Before every task, verify the real repository state. Do not assume this summary is current.

Known architecture and status at the time this file was written:

## Onboarding v2

Current step sequence is intended to be:

```text
welcome
profile
sports
goals_placeholder
schedule_placeholder
review_placeholder
```

Implemented:

- centralized onboarding v2 routing,
- profile step,
- sports step,
- fail-closed module contracts,
- local draft persistence,
- draft migration,
- review prerequisites,
- accessibility checks,
- defensive validation,
- legacy onboarding removed from productive routing and retained only for debug if still present.

The sports module currently uses canonical sport IDs aligned with the training domain. Known canonical IDs include:

```text
gym
running
cycling
swimming
triathlon
football
handball
padel
tennis
athletics
```

Additional supported IDs may include:

```text
basketball
rowing
hiking
walking
other
```

Do not create a second sport namespace. Reuse the existing canonical IDs.

## Authentication

A live registration attempt created a Supabase Auth user but did not complete the expected confirmation flow.

Observed state:

- user created,
- `Confirmed at` empty,
- `Confirmation sent at` empty,
- no last sign-in,
- frontend displayed a server-confirmation error.

This indicates a partially successful registration path. The likely issue is in the contract or flow between:

- frontend `auth.js`,
- Supabase Edge Function,
- Supabase Auth user creation,
- email confirmation,
- and the response returned to the client.

Do not claim the auth flow is fixed until a real end-to-end registration succeeds against the live project.

## Decision engine

`ORVIA-Decision-Engine-v2-Proposal.md` or similarly named documents are proposals unless the code proves implementation.

Treat proposal documents as design input, not as active behavior.

Current architectural target:

```text
normalized inputs
-> safety gate
-> context gate
-> recovery evaluation
-> pain / DOMS relevance
-> load / interference evaluation
-> decision
-> score and caps
-> user-facing explanation
```

The target is one source of truth for decision, status, score, and explanation.

---

# 3. Sources of truth

Use this priority order:

1. **Current executable code**
2. **Current tests**
3. **Database migrations and schemas**
4. **Runtime configuration and deployment files**
5. **Current product requirements explicitly stated by the user**
6. **Repository documentation**
7. **Old reports, roadmaps, proposals, or archived prompts**

Never treat a completion report as proof that code exists.

Never treat a green test report as proof if the tests were not actually executed in the current environment.

Never treat a proposal document as implemented code.

When sources conflict:

- state the conflict,
- inspect the implementation,
- preserve backward compatibility when possible,
- and ask only if a product decision cannot be inferred safely.

---

# 4. Mandatory first-pass workflow

For every non-trivial task, follow this sequence.

## 4.1 Understand the request

Translate the request into:

- target behavior,
- affected user journey,
- expected visible result,
- technical boundaries,
- non-goals,
- acceptance criteria.

Do not start editing while the task is still ambiguous.

Ask a clarifying question only when a wrong assumption could cause:

- data loss,
- schema damage,
- breaking authentication,
- security exposure,
- a major product-direction change,
- or a significant rewrite.

Otherwise, inspect the repository and make the narrowest grounded assumption.

## 4.2 Locate the real implementation

Search by:

- feature name,
- visible text,
- exported function,
- DOM ID/class,
- storage key,
- route,
- database table,
- RPC name,
- test name,
- error message.

Do not stop after the first match.

Map:

```text
UI entry
-> controller
-> domain logic
-> persistence
-> backend
-> tests
```

## 4.3 Read before editing

Read enough context to understand:

- module contract,
- input/output shape,
- state ownership,
- mutation behavior,
- error behavior,
- migration behavior,
- and existing test assumptions.

Avoid broad file dumps. Read targeted ranges and expand only when necessary.

## 4.4 Produce a short internal plan

The plan should normally contain 3–7 steps.

Each step should name:

- file or subsystem,
- intended change,
- verification method.

Do not spend large amounts of tokens narrating the plan to the user unless requested.

## 4.5 Implement in the smallest coherent patch

Prefer:

- one canonical implementation,
- pure domain functions,
- small adapters,
- explicit contracts,
- reversible migrations,
- deterministic normalization,
- and focused tests.

Avoid:

- parallel systems,
- duplicate namespaces,
- hidden fallbacks,
- giant rewrites,
- new abstraction layers without a current need,
- and speculative future architecture.

## 4.6 Verify

At minimum:

1. syntax or type check,
2. focused tests,
3. relevant integration tests,
4. static search for forbidden/legacy paths,
5. regression suite where practical,
6. live/manual verification instructions when runtime access is unavailable.

## 4.7 Report

Report only:

- what changed,
- why,
- tests actually executed,
- tests not executed,
- files changed,
- remaining risks,
- exact manual checks still required.

Never claim “fully fixed”, “production-ready”, or “live validated” without evidence.

---

# 5. Token-efficient working rules

Claude must optimize for result quality per token.

## 5.1 Search narrowly first

Use exact identifiers before semantic exploration:

```text
functionName
error message
DOM id
storage key
RPC name
table name
```

Then broaden only if needed.

## 5.2 Avoid repeated full-file reads

After reading a file once:

- keep a concise map of important functions,
- read only changed or dependent sections,
- do not reprint or re-summarize the entire file.

## 5.3 Avoid duplicate explanations

Do not repeatedly explain the same architecture in:

- planning,
- implementation notes,
- test notes,
- and final report.

Use one concise explanation and refer to it internally.

## 5.4 Use diffs, not rewrites

Prefer targeted edits.

Do not rewrite complete files unless:

- the file is small,
- the structure is irreparably inconsistent,
- or a rewrite is explicitly requested.

## 5.5 Batch related checks

Where supported, combine:

- file searches,
- syntax checks,
- related test commands,
- and static greps.

Do not run the full regression suite after every one-line edit.

Recommended sequence:

```text
edit
-> focused test
-> finish coherent patch
-> full relevant regression
```

## 5.6 Do not over-document temporary reasoning

Internal scratch reasoning should stay concise.

User-facing reports should be factual and structured, not a transcript of the work.

## 5.7 Stop when acceptance criteria are met

Do not add “nice to have” features during a bounded correction pass.

Do not refactor unrelated code because it looks imperfect.

---

# 6. Subagent strategy

Use subagents only when they create real parallelism or reduce context load.

A small task should not spawn multiple agents.

Recommended maximum for most tasks:

```text
1 coordinator + 1–3 focused subagents
```

The coordinator owns:

- final architecture,
- cross-file consistency,
- merge decisions,
- acceptance criteria,
- and final verification.

Subagents must receive:

- a precise objective,
- exact files or subsystem,
- non-goals,
- expected output,
- and a request to report evidence rather than claims.

## 6.1 Repository Scout

Use when the implementation location is unclear.

Objective:

- find relevant files,
- map call paths,
- identify source of truth,
- identify legacy duplicates,
- identify tests.

Output format:

```text
Relevant files
Call path
State ownership
Existing tests
Risks / ambiguity
```

The scout should not edit files unless explicitly told.

## 6.2 Domain Logic Auditor

Use for:

- readiness,
- decision engine,
- load calculations,
- goals,
- plan generation,
- sport rules,
- nutrition calculations,
- sleep calculations.

Objective:

- verify formulas,
- identify contradictory logic,
- identify duplicated sources of truth,
- define invariants,
- suggest pure functions and tests.

The auditor must distinguish:

```text
implemented behavior
proposed behavior
assumption
```

## 6.3 Frontend / UX Auditor

Use for:

- onboarding,
- mobile layouts,
- accessibility,
- navigation,
- forms,
- calendars,
- cards,
- bottom sheets.

Objective:

- inspect rendered states,
- identify missing/blocked interactions,
- verify responsive behavior,
- verify accessibility semantics,
- verify loading/error/empty states.

The auditor must not redesign the entire product during a bug fix.

## 6.4 Backend / Supabase Auditor

Use for:

- Auth,
- Edge Functions,
- RPCs,
- RLS,
- migrations,
- synchronization,
- account deletion,
- email changes,
- invite codes.

Objective:

- map request/response contract,
- verify authorization boundary,
- identify partial-success states,
- verify idempotency,
- verify rollback/cleanup behavior,
- verify secrets remain server-side.

## 6.5 Test Engineer

Use after the implementation shape is known.

Objective:

- identify missing test cases,
- add focused tests,
- detect test stubs that hide integration failures,
- separate offline tests from live tests,
- report exact commands and results.

The Test Engineer must label tests as:

```text
passed
failed
skipped
not run
requires live credentials
```

Never call missing-credential failures “passed”.

## 6.6 Security / Privacy Reviewer

Use for:

- auth,
- wearable data,
- health data,
- exports,
- account deletion,
- coach sharing,
- team access,
- public deployment.

Objective:

- check secrets,
- access control,
- data minimization,
- consent,
- revocation,
- deletion,
- auditability,
- logging,
- and error disclosure.

## 6.7 Migration Reviewer

Use whenever stored user data or database schema changes.

Objective:

- verify forward migration,
- backward compatibility,
- idempotency,
- rollback strategy,
- corrupt-data behavior,
- and old-client behavior.

## 6.8 Documentation Maintainer

Use only after implementation is stable.

Objective:

- update current docs,
- archive stale docs,
- remove contradictions,
- keep root directory clean,
- ensure docs state whether a design is implemented or proposed.

---

# 7. How subagents must collaborate

Subagents must not independently invent incompatible architectures.

Required collaboration pattern:

```text
Coordinator defines task boundary
-> Scout maps current state
-> Specialist proposes/implements narrow change
-> Test Engineer verifies
-> Coordinator resolves conflicts and performs final audit
```

When two agents disagree:

1. inspect code,
2. inspect tests,
3. inspect runtime contract,
4. choose the narrower compatible solution,
5. document the unresolved product decision if necessary.

Do not merge two competing implementations.

---

# 8. Coding principles

## 8.1 Single source of truth

A concept must have one canonical owner.

Examples:

- sport IDs: one catalog/domain registry,
- onboarding step order: one exported sequence,
- review readiness: one predicate,
- training decision: one engine output,
- auth response: one schema,
- activity type normalization: one adapter,
- provider priority: one persisted model.

UI code may format results but must not recreate domain rules.

## 8.2 Pure domain logic

Prefer pure functions for:

- normalization,
- validation,
- score calculation,
- classification,
- migration,
- configuration derivation,
- conflict detection,
- and review prerequisites.

Pure functions should:

- not access DOM,
- not access localStorage,
- not call Supabase,
- not mutate caller-owned objects,
- not throw for malformed user data unless explicitly designed to.

## 8.3 Fail closed for critical modules

For authentication, onboarding prerequisites, account deletion, data sharing, and health-data imports:

- missing module => block the action,
- invalid response => show controlled error,
- do not silently fall back to legacy behavior,
- preserve the user’s data,
- log a safe technical error.

## 8.4 Defensive normalization

Normalization must be:

- deterministic,
- idempotent,
- non-mutating,
- tolerant of old/corrupt input,
- explicit about unknown values.

Test:

```text
normalize(normalize(x)) == normalize(x)
```

## 8.5 Structured results

Prefer:

```js
{
  ok: false,
  data: null,
  errors: {
    field: "Message"
  },
  code: "STRUCTURED_CODE"
}
```

over:

```js
throw "Something failed";
```

Exceptions are for truly exceptional programmer/runtime failures, not expected validation states.

## 8.6 No silent legacy fallback

Legacy code may remain temporarily for migration/debug, but must not activate silently.

Allowed:

```text
explicit debug-only entry
```

Not allowed:

```text
new module unavailable -> silently open old flow
```

## 8.7 Stable public contracts

When changing an API or module contract:

- update all consumers,
- add contract tests,
- support a migration window when needed,
- do not mix multiple response shapes.

---

# 9. JavaScript standards

Use the style already present in the target module unless a migration is explicitly requested.

Current code may use browser-compatible IIFEs and `var`. Do not convert a whole subsystem to another module style during a bounded task.

Requirements:

- meaningful names,
- no unexplained magic constants,
- explicit null handling,
- no accidental globals,
- no mutation of imported/shared state without ownership,
- no swallowed errors unless a safe fallback is intentional,
- comments explain “why”, not obvious syntax.

Avoid:

```js
catch (e) {}
```

unless failure is genuinely non-critical and silent behavior is documented.

For user-facing technical errors:

- log internal context safely,
- show a stable human message,
- never expose secrets or stack traces.

---

# 10. UI and accessibility standards

ORVIA is mobile-first.

Minimum target widths:

```text
320px
375px
390px
430px
desktop
```

Every new screen must handle:

- loading,
- empty,
- error,
- partial data,
- long German text,
- keyboard interaction,
- touch interaction,
- resume/reload,
- and disabled states.

## Accessibility minimums

- semantic buttons, inputs, labels, groups,
- visible focus,
- `aria-invalid` only when actually invalid,
- error text linked with `aria-describedby`,
- `role="alert"` for validation errors where appropriate,
- `aria-pressed` for toggle buttons,
- accessible names for icon-only controls,
- no color-only state communication,
- logical focus after validation,
- focus restoration after modal close,
- no keyboard trap except intentional modal focus trap.

## UX principle

The user should see:

- the next relevant action,
- the reason,
- the consequence,
- and an alternative when appropriate.

Do not overload the user with all available metrics at once.

---

# 11. Onboarding architecture rules

Each onboarding domain step should have:

```text
domain logic module
UI adapter
validation
normalization
migration
draft persistence
module contract
focused tests
review summary
review prerequisite
```

The UI must not contain the source-of-truth business rules.

Each step must be impossible to bypass through generic navigation when invalid.

Expected structured advance function:

```js
{
  ok: true,
  draft,
  errors: {}
}
```

or:

```js
{
  ok: false,
  draft,
  errors
}
```

## Draft rules

- Never silently overwrite an existing draft on `fresh:true`.
- Provide resume / restart / cancel.
- Preserve draft on background, unload, back, and “continue later”.
- Do not mutate raw loaded objects.
- Unknown steps must map through explicit aliases or fail to a safe step.
- `completedSteps` must be ordered, unique, and gap-free.
- Final review status must be set only by the dedicated review function.

## Planned next onboarding domains

Do not implement all at once.

Recommended order:

```text
profile
sports
goals
training schedule
fixed commitments
complaints / constraints
equipment
data providers
review
```

---

# 12. Sport-domain rules

Use the canonical sport registry.

Never introduce:

```text
strength
```

as a parallel ID if the repository uses:

```text
gym
```

Labels may differ by language; IDs must remain stable.

Each sport definition should include enough metadata for future behavior:

```js
{
  id,
  label,
  category,
  icon,
  planningSupported,
  metricsProfile
}
```

Non-plannable activities:

- cannot become primary,
- cannot have `planningEnabled=true`,
- cannot have a planning priority,
- remain recordable.

Selected sports must be normalized consistently.

---

# 13. Decision-engine rules

The training decision must become the single source of truth for:

- daily state,
- action,
- readiness score,
- caps,
- triggers,
- user message,
- coach summary,
- and weekly adjustment recommendation.

Do not allow separate logic paths to independently calculate:

- “green/yellow/red”,
- “peak/ready/limited”,
- score,
- next-run advice,
- and adaptation.

Safety gates override optimistic wearable values.

Examples:

```text
Safety warning + high Body Battery
-> safety warning wins
```

```text
Knee pain 4 + interval run
-> meaningful restriction or swap
```

```text
Knee pain 4 + upper-body session
-> contextual warning, not automatic full stop
```

Scores must expose uncertainty and data quality where practical.

Do not imply medical precision.

---

# 14. Auth and Supabase rules

## 14.1 Secrets

Never place these in client code, GitHub Pages, `env.js`, or logs:

- service-role key,
- private API secrets,
- SMTP credentials,
- provider client secrets,
- database password.

A Supabase anon key may be public by design, but RLS must protect data.

## 14.2 Registration

Registration must be end-to-end coherent.

Required contract:

```js
{
  ok: true,
  user: {
    id: "uuid",
    email: "user@example.com"
  },
  requiresEmailConfirmation: true,
  message: "..."
}
```

or:

```js
{
  ok: false,
  code: "STRUCTURED_CODE",
  message: "..."
}
```

Do not mix:

```text
success
ok
userId
data.user
created
```

across different branches.

## 14.3 Partial success

If the server creates a user but the client treats the request as failed, that is a critical bug.

The flow must define:

- whether the user exists,
- whether confirmation was sent,
- whether the user is confirmed,
- whether a session exists,
- whether retry is safe,
- whether cleanup is required.

## 14.4 Email confirmation

Verify the real provider configuration.

Do not assume `admin.createUser()` sends a confirmation email.

Do not claim a confirmation email was sent unless the provider confirms it.

## 14.5 RLS and RPC

Every table containing user data must be protected.

Tests should cover:

- owner can read/write own data,
- other authenticated user cannot,
- anonymous user cannot,
- service role behavior is server-only,
- RPC validates authenticated identity,
- client-supplied user IDs cannot bypass ownership.

---

# 15. Data and privacy rules

Health, activity, sleep, symptoms, body weight, and wearable data are sensitive product data.

Apply data minimization:

- collect only what is needed,
- explain why,
- support revocation,
- support deletion,
- support export,
- record source and timestamp,
- avoid indefinite raw-data retention without purpose.

Provider imports should preserve:

```text
provider
provider record ID
measured_at
received_at
data type
unit
source device
schema version
sync status
```

Dedupe must be deterministic.

Provider priority should eventually be configurable by data type, not only globally.

---

# 16. Testing standards

## 16.1 Test pyramid

Prefer:

1. pure domain tests,
2. controller/store tests,
3. DOM tests,
4. integration tests,
5. live provider/backend tests,
6. manual device tests.

## 16.2 Every bug needs a regression test

The test must fail before the fix and pass after it.

## 16.3 Required test categories

For normalization:

- null,
- wrong type,
- empty,
- duplicates,
- unknown values,
- corrupt values,
- idempotency,
- non-mutation.

For UI:

- render,
- interaction,
- validation,
- focus,
- autosave,
- reload,
- missing module,
- partial module,
- double click,
- mobile overflow where testable.

For auth:

- success,
- invalid invite,
- duplicate email,
- invalid server body,
- HTTP failure,
- partial success,
- confirmation required,
- pending onboarding key,
- retry behavior.

## 16.4 Honest test reporting

Use exact wording:

```text
Passed: 116/116 local DOM tests
Skipped: 5 live Supabase suites because credentials were unavailable
Not run: iPhone Safari manual test
```

Never write:

```text
Full regression green
```

if live suites failed or were skipped.

## 16.5 Stubs

Stubs must not make a test pass by bypassing the behavior under test.

After adding a stub, ask:

- Does this stub reproduce the real contract?
- Could it hide missing wiring?
- Could it hide a response-shape mismatch?
- Could it hide timing or persistence issues?

---

# 17. Deployment and cache rules

ORVIA is deployed through GitHub Pages and uses a service worker.

When changing cached runtime assets:

- update the service-worker cache version exactly once per coherent deployment,
- ensure all dependent files are uploaded together,
- verify the deployed response, not only the repository file,
- test stale-client behavior,
- do not use repeated arbitrary cache bumps as a substitute for fixing load order.

Verify:

```text
HTTP 200
correct file contents
correct script order
correct cache version
no duplicate script tags
```

A new UI module contract with an old domain module will intentionally fail closed. Deploy dependent files atomically.

---

# 18. Documentation rules

Repository root should remain minimal.

Recommended root:

```text
assets/
docs/
js/
supabase/
tests/
index.html
styles.css
sw.js
manifest.webmanifest
env.example.js
env.js
package.json
package-lock.json
README.md
CLAUDE.md
```

Move planning and audit documents to `docs/`.

Document status explicitly:

```text
IMPLEMENTED
PARTIALLY IMPLEMENTED
PROPOSAL
ARCHIVED
```

Do not keep personal medical or contact information in repository-wide agent instructions.

The existing imported `AGENTS.md` containing a personal daily health prompt is not suitable as a project-wide coding instruction file. Preserve it only if intentionally archived outside the public repository, otherwise remove or replace it.

---

# 19. File-specific guidance

Use this only as a navigation aid. Verify actual files before editing.

Likely responsibilities:

```text
js/calc.js
  readiness, training decision, score-related domain logic

js/ui.js
  primary rendering and page-level adapters

js/issues.js
  complaints/issues series and status

js/profile.js
  profile UI and onboarding entry

js/auth.js
  auth UI and client-side auth workflow

js/training-domain.js
  canonical sport/activity domain definitions

js/onboarding/onboarding-profile-logic.js
  profile normalization and validation

js/onboarding/onboarding-sports-logic.js
  sport catalog, sport selection, sport configuration

js/onboarding/onboarding-logic.js
  onboarding state machine and migrations

js/onboarding/onboarding-store.js
  onboarding draft persistence

js/onboarding/onboarding-steps.js
  step metadata

js/onboarding/onboarding-ui.js
  onboarding DOM adapter

supabase/functions/
  server-side Edge Functions

supabase/migrations/
  schema and RPC changes
```

Do not rely on this map if the repository has changed.

---

# 20. Standard commands

Read `package.json` before running commands.

Do not invent script names.

Typical command categories:

```bash
node --check <changed-file.js>
npm test
npm run test:<suite>
npm run lint
npm run typecheck
```

If no script exists, run the test file directly only when that matches the repository’s existing practice.

For static checks, use targeted searches such as:

```bash
grep -R "openOnboarding(" -n js
grep -R "ready_for_review" -n js
grep -R "sports_placeholder" -n .
grep -R "SERVICE_ROLE" -n .
```

Never print secret values.

---

# 21. Task classification

Classify the request before working.

## Bounded correction

Examples:

- one contract mismatch,
- one fail-closed error,
- one response-shape issue,
- one migration bug.

Rules:

- no feature expansion,
- no unrelated refactor,
- focused tests,
- concise report.

## Feature phase

Examples:

- goals step,
- schedule step,
- weight tracking,
- weekly activity calendar.

Rules:

- audit first,
- define model and invariants,
- implement logic before UI,
- migration,
- tests,
- review summary,
- live acceptance checklist.

## Architecture phase

Examples:

- decision engine unification,
- provider adapter system,
- coach/team roles.

Rules:

- write or update an approved design,
- identify migration path,
- build incrementally,
- maintain compatibility,
- use shadow mode where appropriate,
- do not replace the whole system in one unverified patch.

## Live incident

Examples:

- registration creates user but shows error,
- onboarding module unavailable,
- data disappears,
- PWA loads mixed versions.

Rules:

- stop feature work,
- preserve evidence,
- inspect runtime response,
- identify partial success,
- fix contract/load/deployment,
- verify live before resuming roadmap.

---

# 22. Definition of done

A task is done only when all applicable items are true:

- requested behavior implemented,
- no unrelated behavior changed,
- domain invariants documented in code/tests,
- focused tests pass,
- relevant regression passes or limitations are stated,
- syntax/type checks pass,
- migration exists if stored data changed,
- error/loading/empty states handled,
- accessibility checked,
- secrets not exposed,
- service worker updated only if needed,
- dependent files identified for deployment,
- manual live test checklist provided,
- documentation status updated,
- final report contains no unsupported claims.

---

# 23. Final response format

For implementation work, use this compact structure:

```text
Implemented
- ...

Root cause
- ...

Files changed
- ...

Verification
- Passed: ...
- Skipped: ...
- Not run: ...

Manual live checks
1. ...
2. ...

Remaining risks
- ...
```

For an audit-only task:

```text
Findings
1. Severity — file/function — issue
2. ...

Recommended order
1. ...
2. ...

No code changed.
```

Avoid long ceremonial reports unless requested.

---

# 24. Forbidden behavior

Claude must not:

- claim live verification without live access,
- treat generated reports as evidence,
- silently switch to legacy flows,
- expose secrets,
- put service-role keys in browser code,
- create duplicate sport IDs,
- duplicate decision logic in UI,
- mutate raw stored objects unintentionally,
- delete migrations or user data casually,
- use medical diagnoses as product output,
- add broad features during a bounded fix,
- mark skipped live tests as passed,
- rewrite unrelated files,
- increase cache versions repeatedly without reason,
- hide failures behind test stubs,
- assume a screenshot proves a backend calculation is correct,
- or copy another product’s design, text, branding, icons, or layout one-to-one.

External products may be used as UX inspiration. ORVIA must retain its own design system and product logic.

---

# 25. High-priority roadmap discipline

Unless the user changes priorities, use this order:

1. stabilize live authentication end to end,
2. finish onboarding v2,
3. implement sport-specific goals,
4. implement schedule and fixed commitments,
5. establish a unified decision engine,
6. build a reliable weekly activities view,
7. add weight logging and trend handling,
8. add provider integrations and dedupe,
9. expand nutrition and sleep,
10. add coach and team surfaces.

Do not build coach/team dashboards on unstable athlete data models.

---

# 26. Session-start checklist

At the start of a new Claude session:

```text
1. Read CLAUDE.md.
2. Read the user request.
3. Inspect git status and recent diff if available.
4. Read package.json.
5. Locate the current implementation and tests.
6. Identify whether the task is correction, feature, architecture, or incident.
7. State the narrow working plan internally.
8. Do not edit until source of truth is known.
```

---

# 27. Session-end checklist

Before finishing:

```text
1. Review the diff.
2. Run syntax/type checks.
3. Run focused tests.
4. Run relevant regression.
5. Search for legacy/duplicate paths.
6. Check migration and data compatibility.
7. Check secrets and logging.
8. Check service-worker impact.
9. Record skipped/not-run tests honestly.
10. Provide exact deployment files and live checks.
```

---

# 28. Compact instruction block for delegated subagents

Use this template when delegating:

```text
You are the [ROLE] for ORVIA.

Objective:
[one precise objective]

Scope:
[exact files/subsystem]

Non-goals:
[what must not be changed]

Required checks:
- inspect current implementation
- preserve canonical contracts
- avoid parallel architecture
- add or identify focused tests
- report evidence, not claims

Return:
1. findings or patch summary
2. files/functions affected
3. tests executed
4. risks and unresolved points

Do not modify unrelated files.
```

---

# 29. Product quality principle

ORVIA should become more capable without becoming harder to use.

The desired end state is:

> The athlete sees the next meaningful action.  
> The coach sees the athletes who need attention.  
> The system handles the complexity in the background.  
> Every recommendation remains explainable, contextual, and honest about uncertainty.
