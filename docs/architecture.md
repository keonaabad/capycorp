# CapyCorp — Architecture Decisions (Phase 0 / Phase 1)

Source of truth for product intent: [`product-proposal.md`](./product-proposal.md).
This document covers only the decisions needed to build the static office
prototype (Phase 1) and sets direction for what comes after, without
locking in details that don't matter yet.

## 1. Application structure

Single Next.js (App Router) repository, no monorepo split yet. The
proposal's suggested `apps/web` + `apps/worker` + `packages/*` structure is
real but premature: there is no backend, no worker, and no shared package
boundary to enforce until orchestration exists. Splitting now would add
tooling overhead with nothing on the other side of the boundary.

Current layout:

```text
capycorp/
  app/                    # routes, layout, metadata
  components/office/      # React components for the simulation UI
  lib/simulation/         # state machine, office layout, adapter — no React
  tests/e2e/               # Playwright specs
  docs/
```

`lib/simulation/*` has no dependency on React or Pixi. It is plain,
synchronously-testable TypeScript, which is why the state machine has unit
tests but no rendering test.

## 2. PostgreSQL + Prisma — deferred

Nothing in Phase 1 persists. There is no account, no saved business, no
task history — the dev control panel resets on every page load. Adding a
database now would mean designing schema and migrations against
requirements (multi-business ownership, event history, artifacts) that
Phase 1 explicitly does not implement, per the proposal's own MVP-scope
discipline. Postgres + Prisma stay planned for Phase 2 (`docs/product-proposal.md`
section 13 has the initial schema draft).

## 3. PixiJS vs. Phaser

**Chosen: PixiJS.** Phaser brings scene management, physics, and
pathfinding that this phase does not need — every workstation has a fixed
destination coordinate and agents move via linear interpolation, not
collision-aware pathfinding. Phaser's extra surface area would be
unused weight. PixiJS gives a plain `Application` + `Container`/`Graphics`
scene graph that a single React component (`components/office/office-canvas.tsx`)
can own end-to-end.

Version note: PixiJS 8 changed initialization to async (`app.init()`
instead of a synchronous constructor) and moved shape drawing to a
chained `.rect().fill()` style API. The proposal was written against
general PixiJS guidance, not a pinned version — this build targets 8.19.

## 4. Zustand and TanStack Query

**Zustand: adopted now**, but only inside `lib/simulation/adapter.ts`,
never imported directly by components. Components talk to an
`OfficeEventAdapter` interface (`getSnapshot`/`subscribe`/command methods);
`createLocalOfficeAdapter()` happens to implement that interface with a
Zustand vanilla store. The point of the indirection: when Phase 2 replaces
manual dev-panel-driven state with a real backend event stream, the
adapter interface doesn't change — only a new `createBackendOfficeAdapter()`
gets written, and every component (`OfficeCanvas`, `DevControlPanel`,
`AgentInspector`) keeps working unmodified.

**TanStack Query: deferred.** There is no server data to fetch yet — the
dev control panel _is_ the data source. It becomes relevant the moment
Phase 2 adds authenticated API routes.

The React-facing hook (`useOfficeSnapshot`) is built on `useSyncExternalStore`
rather than `zustand/react`'s `useStore`, specifically so components only
depend on the adapter's plain `subscribe`/`getSnapshot` shape — not on
Zustand's React bindings. This keeps the "swap the adapter later" story
honest rather than aspirational.

## 5. Real-time transport (SSE vs. WebSockets)

**Recommendation carried forward from the proposal: Server-Sent Events**,
once there's a backend to stream from. Not implemented in Phase 1 — the
`OfficeEventAdapter` interface is shaped so that a future SSE-backed
adapter can push snapshot updates through the same `subscribe(listener)`
contract the local adapter already uses.

## 6. Redis and BullMQ — deferred until orchestration

No background jobs exist yet; nothing needs a queue. Deferred exactly as
the proposal specifies, until Phase 3 introduces the planner/scheduler
loop.

## 7. Agent roster for Phase 1

Four agents, matching the proposal's MVP requirement of four to six:
Manager (Moss), Engineer (Hazel), Researcher (Wren), Designer (Basil).
Positions and role colors live in `lib/simulation/office-layout.ts`. Sprites
are original procedurally-drawn placeholder shapes (rounded-rectangle
body + head + ear circles + a role-colored accent square), per the
proposal's risk mitigation to not spend Phase 1 time on final art.

## 8. Risks and assumptions carried into this phase

- **Assumption:** four fixed desks plus one shared meeting table and one
  manager inbox is enough destination variety to demonstrate every state
  in the table from proposal section 14, without needing pathfinding.
  Holds for Phase 1; will need revisiting if agent count grows.
- **Risk — synthetic vs. real input during testing:** Pixi's event
  boundary does not reliably respond to hand-constructed `PointerEvent`
  dispatches in headless debugging; only Playwright's real
  `page.mouse.click()` (or an actual user) reliably triggers `pointertap`.
  The e2e suite is the authoritative check for interaction, not manual
  `dispatchEvent` probing.
- **Risk — Node version:** this environment runs Node 20.12, below what
  Vitest 4 / Rolldown's native binding requires (20.19+). Vitest is
  pinned to `^2` to avoid the native-binding install failure rather than
  upgrading the system Node install. Revisit the pin once the environment's
  Node version moves.
- **Assumption:** the frontend must never invent progress (proposal
  section 11). Enforced structurally in Phase 1: `destinationForState`
  and the state badge are pure functions of the adapter's snapshot: there
  is no local timer or animation that advances an agent's state on its
  own. The only exception is the pause-flash/idle-bob visual flourish,
  which is cosmetic and does not change `AgentState`.

## 9. Phased task checklist for this milestone

Static office prototype (Phase 0 + Phase 1), matching proposal section 22:

- [x] Next.js + TypeScript + Tailwind + ESLint scaffold
- [x] Prettier, Vitest, Playwright wired with scripts in `package.json`
- [x] PixiJS office scene: floor, four desks, meeting table, manager inbox
- [x] Four capybara placeholders with name/role/state badge
- [x] Strict frontend state machine (`lib/simulation/state-machine.ts`) with
      the exact 12 states from the proposal, plus pause/resume semantics
- [x] Dev control panel driving real state transitions per agent
- [x] Click-to-inspect panel (name, role, state, task)
- [x] Walking animation via destination interpolation; idle/paused/complete/
      failed visual treatment
- [x] Simulation isolated behind `OfficeEventAdapter`
- [x] Unit tests for the state machine (15 cases)
- [x] Playwright test covering state transitions and click-to-inspect
- [x] README with setup instructions

Not started (intentionally, see proposal section 8 and section 17 Phase 2+):
auth, persistence, real orchestration, multi-business, billing.

## 10. Phase 1.5: deterministic fake event stream — done

Per proposal section 23, before touching real AI orchestration: prove the
`OfficeEventAdapter` abstraction is actually swappable by driving it from
something other than the dev control panel.

- `lib/simulation/demo-script.ts` — a scripted timeline modeling the
  proposal's "Example interaction" (a manager delegating research, design,
  and engineering subtasks, then assembling a final brief), adapted to
  this build's real four-agent roster.
- `lib/simulation/script-player.ts` — plays a script's steps against
  **any** `OfficeEventAdapter` on a timer, with optional looping that
  resets touched agents between runs via the new `reset()` transition
  (`state-machine.ts`), unit tested with Vitest fake timers.
- The "Play scripted demo" button in `OfficeExperience` runs the script
  against the _same_ local adapter instance the dev panel already uses.
  `OfficeCanvas`, `DevControlPanel`, and `AgentInspector` required zero
  changes — they only ever call `adapter.subscribe()`/`getSnapshot()`,
  so they don't know or care whether a click or a `setTimeout` triggered
  the update. That's the actual proof the adapter abstraction holds.

The dev panel disables itself while the script plays, so the two drivers
never fight over the same agents.

## 11. Phase 2, part 1: database and authentication — done

### Local Postgres, not a hosted service

This environment has no Docker and no external DB account was going to
get created on the user's behalf, but it does have PostgreSQL 17
installed natively (Windows service, already running). Rather than push
for a hosted free-tier Postgres (Neon/Supabase), which would mean the
user creating a third-party account, this build connects to that local
instance through a dedicated least-privilege role:

```sql
CREATE ROLE capycorp_app WITH LOGIN PASSWORD '...' CREATEDB;
CREATE DATABASE capycorp OWNER capycorp_app;
```

`CREATEDB` is only needed for `prisma migrate dev`'s shadow database (used
to diff schema changes); the app itself never needs more than read/write
on its own database. This keeps the Postgres superuser password out of
the project entirely — `capycorp_app`'s credentials live only in the
git-ignored `.env`.

### Prisma pinned to `^6`

Same constraint as Vitest: Prisma 7 requires Node ≥20.19, this
environment runs 20.12. Pinned to the last major that supports it.

### Auth.js Credentials, not OAuth or a hosted auth provider

Email + password via Auth.js's Credentials provider, `bcryptjs` hashing,
JWT sessions (`session: { strategy: "jwt" }`) — no `@auth/prisma-adapter`,
since that adapter's schema (`Account`/`Session`/`VerificationToken`) only
earns its keep for OAuth account linking or database-backed sessions,
neither of which this build uses. The tradeoff: adding an OAuth provider
later means introducing that adapter and its tables at that point, not
before they're needed.

`AgentRole`'s Prisma enum values are lowercase specifically to match the
`AgentRole` union already in `lib/simulation/office-layout.ts` — one
source of truth for the string values, no mapping layer between the DB
and the simulation code.

### What this did and didn't touch

`app/page.tsx` is now an async Server Component that calls `auth()` and
redirects unauthenticated visitors to `/sign-in`. That's the only change
to the simulation-facing code. `OfficeExperience`, `OfficeCanvas`,
`DevControlPanel`, `AgentInspector`, and the entire `lib/simulation/*`
layer are untouched — they still run on `createLocalOfficeAdapter()`,
which has no idea a database now exists. Signing in gates _access_ to the
page; it doesn't yet change what the page shows.

## 12. Phase 2, part 2: wire the simulation to the database — done

Business-selection screen (`/`) backed by real `Business` rows, agents
created from the `AgentRole` templates on business creation, and a new
`OfficeEventAdapter` implementation (`createBackendOfficeAdapter`) that
reads/writes through API routes instead of an in-memory store.

### The "zero changes" claim from the previous milestone didn't fully hold

`OfficeCanvas`, `DevControlPanel`, and `AgentInspector` all imported the
Phase 1 fixed-id `AGENTS` array directly — a shortcut that worked as long
as every adapter had the same 4 hardcoded agents, which stopped being true
once a business's agents get real DB ids. All three needed small, mechanical
edits: read the agent list from `adapter.agentOrder` and the display fields
(`name`/`role`/`accentColor`/`idlePosition`/`deskPosition`) off the
snapshot entry itself, instead of cross-referencing a static import. Their
actual logic (transitions, rendering, click handling) is unchanged — this
is the honest version of "zero changes," not the literal one.

### The adapter interface had to become async

`OfficeEventAdapter`'s mutators were typed to return `TransitionResult`
synchronously. A backend implementation can't honor that — it needs a
network round trip — so `setAgentState`/`pauseAgent`/`resumeAgent`/
`resetAgent` now return `Promise<TransitionResult>`. `createLocalOfficeAdapter`
adapts trivially (same-tick resolution via `Promise.resolve`), so `/demo`
and its tests are unaffected in practice.

### Runtime state moved from memory-only to columns on `Agent`

`Agent` gained `state`/`resumeState`/`currentTask` (migration
`20260802213111_add_agent_runtime_state`, new `AgentState` enum mirroring
`lib/simulation/state-machine.ts`'s 12 states exactly). `PATCH
/api/agents/:id` reuses `state-machine.ts`'s pure `setState`/`pause`/
`resume`/`reset` functions unchanged — the module's framework-independence
(no React, no DB import) paid off exactly as intended when it was written
in Phase 1.

### Never optimistic for state, with one deliberate exception

Per section 8's "frontend must never invent progress" rule, the backend
adapter's state-mutating commands only update the store from the server's
confirmed response, never before. `setAgentTask` is the one exception:
`AgentInspector`'s task input fires on every keystroke, so it updates the
store immediately and debounces the network write (~400ms) — task text
isn't consistency-critical the way state transitions are, and the
alternative is a network request per keystroke.

### `/demo` split from the real office

The original Phase 1 experience (demo-toggle + local adapter +
`OfficeCanvas`/`DevControlPanel`/`AgentInspector`) moved to `/demo`
unchanged, still useful as a fixture for local development and tests.
`OfficeWorkspace` (canvas + inspector + dev-panel grid) was extracted so
`/demo` and `/business/[id]` share it without duplication — the local and
backend adapters are otherwise interchangeable at that boundary.

### What this didn't do

No activity-timeline UI (an `AgentEvent` row is written on every state
change — `type: "agent.state_changed"` — but nothing reads it back yet).
No real orchestration (Phase 3), no SSE/real-time (Phase 4), no
multi-floor building UI (Phase 5), no agent renaming.

## 13. Phase 3, part 1: the real planner loop — done

A goal submitted through the new task composer is now actually planned and
executed by Claude — not a script, not the dev panel. Scoped deliberately
smaller than full Phase 3 (see product-proposal.md §17): planner, subtask
generation, agent assignment, structured outputs, and event publishing are
in; a real tool registry and live/streaming visualization are not.

### Model provider abstraction — `lib/ai/`

`lib/ai/client.ts` is a thin Anthropic client singleton, mirroring
`lib/prisma.ts`'s pattern. `requireModel()` reads `ANTHROPIC_MODEL` at call
time and throws if unset — deliberately no hardcoded default. The exact
current Claude API model id isn't something to guess from training data;
it has to come from whoever's running this, checked against their own
Anthropic console.

`lib/ai/planner.ts`'s `planTask()` is the "structured outputs" deliverable:
a forced tool-use call (`tool_choice: {type: "tool", name: "..."}`) so the
response is parsed JSON, not free text — the model proposes one subtask per
relevant non-manager role, and may legitimately propose fewer than three
if not every role is relevant to the goal. `lib/ai/perform-subtask.ts` is
a single plain-text call per subtask standing in for a real tool call,
explicitly framed in the prompt as simulated with no external side
effects — the tool registry itself is out of scope for this pass.

### The orchestration route reuses `state-machine.ts` unchanged, again

`POST /api/businesses/[id]/tasks` drives the manager and each subtask's
agent through the exact same pure transition functions
(`app/api/agents/[id]/route.ts` already proved this reusability once for
the human-driven path). The shared logic was extracted into
`lib/server/agent-transitions.ts`'s `persistAgentTransition()` so neither
path can drift from the other. Subtask work runs in parallel
(`Promise.all`) since the subtasks are independent — this keeps total
latency close to one Claude call instead of three, which matters because
of the next decision:

### Synchronous, not live — a deliberate product tradeoff

The whole loop (plan → drive manager → run subtasks in parallel → drive
manager to completed) happens inside one HTTP request. No SSE, no
polling, no background worker. This was an explicit choice, not a
shortcut taken silently: the alternative (watching capybaras move through
states in real time) needs the run detached from the request lifecycle
plus a way for the client to observe it, which is exactly what Phase 4
("Real-time simulation synchronization") is for. Building that now would
mean solving Phase 4's problem to deliver Phase 3's value. The dev panel
is disabled while a run is in flight so it can't race a live mutation.

### Failure handling has two layers, deliberately

A single subtask failing (a malformed model response, a network error)
marks that subtask and its agent `failed` and returns `{ok: false}` — it
does **not** abort the other subtasks or throw, since one Claude call
failing shouldn't waste the two calls that already succeeded. An outer
`try`/`catch` around the whole orchestration catches anything
_unexpected_ (a bug, a transition that should always succeed but didn't)
and marks the `Task` `failed` rather than leaving it stuck at `running`
forever. Planner failure specifically returns `502` before any agent has
moved, since nothing should visibly happen until there's an actual plan.

### The client-side gotcha this milestone surfaced

`BusinessOffice`'s adapter is seeded once, in `useState`'s initializer. A
task run mutates the database directly (not through the adapter), so a
bare `router.refresh()` after a run re-fetches the Server Component's data
but does nothing to the already-constructed client store.
`app/business/[id]/page.tsx` now passes a `key` prop to `BusinessOffice`
derived from the agents' `updatedAt` fingerprint, forcing a remount (and a
fresh adapter) exactly when the server data actually changed — not on
every render.

### What this didn't do

No live/streaming view (Phase 4, by design — see above). No real tool
registry — `performSubtaskWork()` is explicitly a simulated action. No
human approval gate before a task runs or before it uses "tools" — every
transition auto-advances; a real approval step would need the same
detached-execution model that live viewing needs. No activity-timeline UI
reading back the `AgentEvent` rows this and the previous milestone both
write. No task cancellation or pause mid-run (not meaningful yet since a
run is one synchronous request).

## 14. Phase 4, pulled forward: watch a task run live — done

Section 13 recommended Phase 4 next; it happened immediately, not later —
the first demo recording of the synchronous version made the gap obvious
in person: the task jumped straight from "Running…" to "completed" with
zero visible animation, undercutting the entire pitch of a pixel-office
product ("watch the capybaras work"). Pulled forward to fix that
specifically, not to complete the rest of Phase 4's scope.

### Polling, not SSE — a considered deviation from the proposal

`docs/product-proposal.md` and this document's own §5 recommend SSE for
real-time transport. Not used here, on purpose: there is no pub/sub layer
in this codebase (Redis/BullMQ explicitly deferred, §6), so an SSE handler
would itself have to poll Postgres on an interval and push diffs — meaning
SSE would be _more_ code than polling here (a `ReadableStream`, manual
event framing, heartbeats, `request.signal.abort` cleanup), not less. The
`OfficeEventAdapter` abstraction already isolates this decision inside
`createBackendOfficeAdapter` — a future switch to SSE touches no
component, since `OfficeCanvas`/`DevControlPanel`/`AgentInspector` only
ever see the Zustand store update, never how it got updated.

### Detaching execution from the request — and its real limits

The whole point required breaking the assumption Phase 3 part 1 made
(everything happens inside one HTTP request, so nothing is observable
until it's over). `route.ts`'s `POST` now does only the fast, synchronous
part (validate, reset stale agents, create the `Task` row) and then calls
`runTaskOrchestration()` — moved to its own file,
`app/api/businesses/[id]/tasks/run-task-orchestration.ts` — fire-and-forget
(`void promise.catch(...)`, not awaited), returning `202` with just
`{taskId}` immediately. A new `GET .../tasks/[taskId]` is what the client
polls (~1.5s) for live agent state.

This only works because this is a long-lived `next dev`/`next start` Node
process — nothing kills it after the response is sent, so the pending
promise keeps running. Two consequences worth stating plainly: a real
deployment (e.g. Vercel serverless) would need an actual background-job
system, not this trick — this is a known, local-dev-scoped limitation, not
an oversight. And a `next dev` file-save mid-run can abandon the in-flight
orchestration, leaving `Task.status` stuck at `"running"` and its agents
non-idle; the existing `midRun` 409 check (unchanged from Phase 3 part 1)
is what surfaces that if it happens — expected during local development,
not a bug to chase.

`runTaskOrchestration` was deliberately extracted to its own module rather
than staying a second export in `route.ts`, so `route.test.ts` can mock it
wholesale — otherwise a POST-focused test could return before the
fire-and-forget promise settles, letting its pending Prisma calls land
after the next test's mock state had already been reset.

### A bug caught before it shipped: the remount rubber-band

Live polling surfaced a latent issue that was invisible before it existed.
`app/business/[id]/page.tsx` already remounts `BusinessOffice` via a `key`
derived from agents' `updatedAt` whenever server data changes — a
completed run always changes that fingerprint, so the `router.refresh()`
that ends a poll loop always triggers a remount. `OfficeCanvas`'s
`buildCapybara` used to hardcode every sprite's start position to
`idlePosition`, letting the ticker interpolate over to the true
destination on mount. Before live polling existed, that walk-on-mount was
the _only_ animation ever shown, so nobody could see it was replaying from
idle every time. Once a user can watch an agent smoothly arrive at its
desk via live polling, that same remount would snap it back to idle and
replay the walk — a visible glitch at the exact moment the demo needed to
look best. Fixed by seeding both the sprite's initial position and its
`target` from `destinationForState(agent, agent.current)` instead of
always `idlePosition` — a genuine correctness fix `git blame` will show
was caused by a design review catching an interaction between two
features, not a regression.

### `Task.error` — a gap only detachment created

Before this milestone, a top-level orchestration failure (planner error,
an unexpected exception) returned `{error: message}` directly in the
synchronous response — never persisted, because it didn't need to be.
Once detached, that message has nowhere to go unless something stores it;
a bare polled `status: "failed"` with no explanation isn't useful. Added
`Task.error String?`, populated in `runTaskOrchestration`'s outer catch,
returned by the poll endpoint. Per-subtask failures still use
`Subtask.result`, unchanged.

### What this didn't do

No SSE (considered and deferred above, not an oversight). No real tool
registry, no human approval gating, no task cancellation mid-run, no
activity-timeline UI — all unchanged from Phase 3 part 1's own list. No
production-deployment story for the fire-and-forget execution model — that
remains local-dev-scoped until a real background-job system exists.

## 15. Recommended next milestone

A real tool registry (web search, structured JSON output, a calculator) —
the "work" agents do is still explicitly simulated
(`performSubtaskWork()`'s prompt says so outright). This is Phase 3's
original remaining scope, and now that a run is watchable live, making the
work itself real is worth more than it would have been before this
milestone.
