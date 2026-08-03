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

## 15. Real web search — done

`performSubtaskWork()` no longer produces a fictional summary — it's a
real multi-turn tool-use loop against Claude, with a real Tavily-backed
`web_search` tool the model can call (`tool_choice: "auto"` — it decides
whether searching would help, it isn't forced). Scope deliberately
narrow, confirmed with the user: web search only, not a calculator, file
generation, or a generic tool-permission system — `docs/product-proposal.md`
already treats a full tool registry as separate, later scope, and building
an abstraction for exactly one tool now would solve a problem that
doesn't exist yet.

This is also the first time `"using_tool"` — one of the state machine's
original 12 states, defined since Phase 1 — has ever been driven by real
logic. `STATE_LABEL` and `destinationForState` already handled it for
rendering from day one; it just never had anything real to represent
until now.

### Considered and rejected: Anthropic's server-side web search tool

The SDK ships `web_search_20250305` — a server-side tool where Anthropic
executes the search internally and returns already-resolved result
blocks in one `.messages.create()` call, no client-side loop needed. Not
used: it would give no hook point to drive `using_tool` mid-call or
record this app's own `AgentEvent` shape, and the user wanted their own
Tavily key and control over the provider. Worth knowing, not worth
switching to.

### The hook contract, not a generic tool registry

`lib/ai/*` has kept a zero-Prisma-imports boundary since Phase 3 (mirrored
by `lib/simulation/*`'s zero-React-imports boundary) — state and DB stay
the caller's concern, error-shaping into a `tool_result` stays the AI
layer's. Rather than thread Prisma into `perform-subtask.ts` or invent a
generic plugin system for one tool, it takes a single typed hook:

```ts
export interface SubtaskToolHooks {
  onWebSearch(
    query: string,
    run: () => Promise<WebSearchResult[]>,
  ): Promise<WebSearchResult[]>;
}
```

`run-task-orchestration.ts`'s `runSubtask` supplies the real hook: before
executing an actual search it drives `working → using_tool` (reusing the
same `driveAgentStates` helper everything else already uses) and writes
an `AgentEvent` (`type: "agent.tool_started"`, matching
`docs/product-proposal.md` §12's own event-naming convention rather than
inventing a new one); after the search, a paired `"agent.tool_completed"`
event; in a `finally`, drives back to `"working"` regardless of
success/failure. This fires **once per actual tool execution**, not once
per subtask — if the model searches three times, that's three real
`working→using_tool→working` cycles, each with its own event, because
using_tool is supposed to mean "invoking a tool right now," not "this
subtask happens to use tools somewhere."

Search failures (network, auth, rate limit) are caught and fed back to
the model as a `tool_result` with `is_error: true` rather than failing
the subtask outright — the model gets a chance to recover (answer from
its own knowledge, note the search failed) the same way a real agent
would try again or work around a broken tool, rather than the whole
subtask dying over one transient Tavily hiccup. Only the Anthropic call
itself failing, or the tool loop exceeding its iteration cap, propagates
as a real subtask failure.

### What this didn't do

No calculator, no file generation, no structured artifact storage, no
generic multi-tool permission system (`ToolDefinition`/`AgentToolPermission`
from the proposal's draft schema stay unbuilt). No SSE — still polling,
per §14's already-documented reasoning; a fast search can complete inside
one polling interval and never be visibly observed, same accepted
limitation as before. No production deployment story for the
fire-and-forget execution model — unchanged from §14.

## 16. Activity timeline UI — done

`AgentEvent` had been written to since Phase 3 with nothing ever reading it
back — every prior milestone's "What this didn't do" listed this as
deferred, and `docs/product-proposal.md` §15 named the component
(`ActivityFeed`) without it ever getting built. It's built now: the
business page renders a chronological feed of every `agent.state_changed`,
`agent.tool_started`, and `agent.tool_completed` row for that business.

### No new API route — same reasoning as §14's `GET` routes, applied again

`app/business/[id]/page.tsx` already queries Prisma directly as a Server
Component; the feed is one more `prisma.agentEvent.findMany(...)` call
alongside the existing agents fetch, fully index-backed
(`@@index([businessId, createdAt])`). No route exists with no other
caller — the same YAGNI call already made once in this codebase for the
office page's own data, made again here rather than re-litigated.

### The refresh mechanism needed zero new wiring — confirmed, not assumed

`BusinessOffice`'s live-polling `useEffect` already calls `router.refresh()`
once a task run finishes, which reruns the _entire_ Server Component tree
unconditionally — including this new query. `ActivityFeed` is a plain
server-rendered sibling with no client state of its own, so it isn't
gated by `BusinessOffice`'s `key={agentsFingerprint}` remount trick at
all; that mechanism exists solely to reseed one client component's
adapter. First real end-to-end test (extending `tests/e2e/business.spec.ts`'s
existing reload, not a new spec) passed on the first try, confirming the
reasoning held rather than just sounding right.

### Defensive parsing has two layers, not one

`AgentEvent.data` (`Prisma.JsonValue | null`) has zero structural link to
`type` at the type level — a _recognized_ `type` can still carry `null` or
malformed `data` (schema-legal, `data` is optional), not just an
_unrecognized_ `type`. `formatEventLabel()` (`lib/events/format-event.ts`)
falls back to a plain label for both cases rather than throwing, since a
render-time exception over one bad row would fail the whole feed, not just
one line — reusing the same `typeof x === "object" && x !== null`
narrowing idiom already used at every other JSON boundary in this codebase
(`lib/ai/planner.ts`, every route handler).

### What this didn't do

No pagination or filtering UI (`take: 50`, newest-first, no "load more").
No live mid-task-run streaming of new events — the office canvas already
owns "watch it happen live"; this is a history log, refreshed the same way
the rest of the page already refreshes. No new event types.

## 17. Polish pass: pixel art, chrome, and a landing page — done

Picked over the other option named in the previous version of this section
(a real tool registry) — this one raised the portfolio ceiling without
touching backend logic, and unlike the tool registry it's genuinely
underspecified until a human reacts to concrete visuals, so it was worth
doing first while the rest of the app is stable.

### The direction was chosen from options, not guessed

Before writing any component code, three chrome/palette directions and two
pixel-art rendering styles were mocked up as a standalone reviewable
artifact and shown to the user, grounded directly in `product-proposal.md`
section 5's own visual brief ("cozy professional office... friendly but
not childish... restrained palette... clean modern application chrome").
Chosen: **Slate and brass** chrome (cool light-gray surfaces, a brass
accent) and **soft-shaded** pixel art (banded light-to-shadow shading, no
outline) over a warmer paper palette, a dark ink-rail palette, and a
flat-outlined retro art style. Worth naming what this replaced: the app's
entire chrome — nav, forms, dashboard — had been a near-black background
with lime-green monospace accents since Phase 1, closer to a hacker
terminal than the brief it was supposedly built against.

### Design tokens, not per-component hex values

`app/globals.css` defines the palette once as CSS custom properties
(`--page`, `--surface`, `--ink`, `--muted`, `--accent`, `--accent-ink`,
`--border`, `--active`, `--danger`), mapped into Tailwind v4's `@theme
inline` block exactly the way the scaffold's original `--background`/
`--foreground` pair already did — so `bg-page`, `text-accent`, etc. are
real Tailwind utilities, not arbitrary-value hex littered across every
component. Deliberately a single fixed theme with no dark-mode variant:
this app has never had a theme toggle, and the old scheme wasn't a
dark-mode adaptation of anything to begin with, just the only theme that
existed.

### Real pixel art, still hand-authored — no external assets

Per the proposal's originality rule (section 5: no copied sprites or
assets), `components/office/capybara-sprite.ts` draws each role onto a
tiny `20x22` canvas using plain `fillRect`/`clearRect` calls — a
`roundedRect` helper that fills a rect and then clears its four corner
pixels, rather than hundreds of hand-placed per-pixel coordinates. All
four roles share one head/fur/face function (same species, per the
proposal's character sheet); only the outfit-drawing function differs
per role, and only the tie color is a fixed constant — every garment
shade is computed from the role's existing `accentColor`
(`lib/simulation/office-layout.ts`) via a `tint()` helper, so the role
color stays defined in exactly one place.

`office-canvas.tsx` wraps that canvas in a Pixi `Texture` with
`scaleMode: "nearest"` and displays it via `Sprite` instead of the old
`Graphics`-built rounded-rect blob — nearest-neighbor sampling is what
keeps the upscaled result crisp instead of blurring back into a
placeholder-looking shape. The office floor, desks, meeting table, and
inbox got the same warm-wood retint (previously near-black) so the
interior itself reads as "cozy office," independent of the surrounding
app chrome.

### A real landing page, not just a restyled gate

`app/page.tsx` was the authenticated dashboard since Phase 2 (redirecting
straight to `/sign-in` otherwise) — it's now a public marketing page, and
the dashboard moved to `app/dashboard/page.tsx` unchanged in behavior.
The landing page's "see it in action" section embeds the existing
`OfficeExperience` component directly — the same self-contained,
local-adapter scripted demo `/demo` already used, requiring no backend
and no auth. Reusing it rather than building a new hero animation meant
the landing page's centerpiece is the actual product running, not a
description of it.

Every redirect target that pointed at `/` (sign-in, sign-up, the
business-not-found case, `auth.ts`'s post-login destination via each
page's own `router.push`) now points at `/dashboard`. `tests/e2e/auth-gate.spec.ts`
was rewritten to match: it now asserts the root shows the public landing
page instead of redirecting, and that `/dashboard` (not `/`) is the
gated route.

### What this didn't do

No dark-mode toggle (see above — the app has never had one). No new
pixel-art states beyond the existing idle/working/etc. state machine —
only the sprite's *appearance* changed, not what drives it. No animation
polish on the landing page itself beyond what `OfficeExperience` already
does. No real tool registry — still the one piece of the original Phase 3
proposal scope left unbuilt.

## 18. Office v2: walled rooms, doors, and walk animation — done

The previous milestone made the office scene's *characters* real pixel
art; this one does the same for the *scene* itself. The user shared a
top-down pixel-office reference image and asked for each capybara to have
its own room and for real walking animation, not just position
interpolation. Two scope calls, made explicit before writing code and
confirmed with the user: the reference is a specific paid tileset asset,
so this builds original room/prop art in the same top-down genre rather
than copying it (`product-proposal.md` §5's originality rule again); and
the capybara sprites themselves keep last milestone's front-facing
soft-shaded look rather than being re-angled to a literal top-down view —
"top view" is the room layout, not a character redesign.

### Position was already a pure function of state — that's what made this tractable

`destinationForState()` has never stored position on the adapter or
backend; it derives a point purely from `(role, state)`, computed
client-side. Adding walls meant that single point was no longer enough —
a straight line from a desk to the meeting table now cuts through a wall —
but the fix stayed entirely inside `lib/simulation/office-layout.ts` and
`office-canvas.tsx`. No adapter, API route, or Prisma schema changed.

`office-layout.ts` gained `OfficeZone` (`AgentRole | "hallway"` — the
existing role type doubles as the room identifier, no separate enum),
`zoneForState()`, and `pathTo()`. `pathTo` returns a single-point path
(exactly today's behavior) when the destination is already in the
caller's current zone — the common case, since most transitions stay
inside one's own room — and only inserts door/hallway waypoints when
crossing rooms. `needs_approval` always resolves to the **manager's**
zone regardless of whose task it is, since the inbox lives at a side
table inside the manager's room, not a generic prop floating in the
hallway — an agent going for approval now visibly leaves its own room and
walks into someone else's.

### The recompute guard that avoids a mid-walk backtrack

`office-canvas.tsx`'s `SpriteRig` replaced its single `target` point with
a `path` queue and a `zone` (which room it's currently standing in, once
`path` empties). The path is only recomputed when `state !== rig.lastState` —
reusing the guard already in place for the completion-flash effect —
never on every snapshot emission. This isn't cosmetic: a snapshot fires
on every store change, including an unrelated task-text keystroke: if a
new path were computed mid-walk from the stale `fromZone` the sprite
hadn't actually reached yet, the sprite would replay already-passed
waypoints and visibly backtrack.

### Walk animation reused the sprite pipeline instead of adding a new one

`capybara-sprite.ts`'s grid is `20x22`, but every role's art stops at row
20 — row 21 was unused headroom. `drawCapybaraSprite` gained a `frame: 0 | 1`
parameter that draws two small feet there, offset between frames; that's
the entire walk cycle, no sprite-sheet system needed. Facing flips via
`body.scale.x = facing * SPRITE_SCALE` based on the current waypoint's
`dx` sign, ignoring small `dx` so a vertical-only leg of a path (walking
straight through a door) doesn't flicker between facings.

### A real perf regression, caught by a flaky test, fixed by laziness

Building both walk-cycle textures for all 4 sprites eagerly at mount (8
canvas draws + GPU texture uploads, up from 4 before this milestone)
added enough one-time synchronous main-thread work to make
`tests/e2e/office.spec.ts`'s tight-timing scripted-demo test fail
consistently under this environment's default 4-parallel-worker
Playwright config — not by a little; it went from "occasionally flaky"
(confirmed present before this milestone too) to "fails every parallel
run." Fixed by building only the standing-frame texture eagerly and the
walk frame lazily, the first time an agent actually starts moving,
spreading that cost out instead of paying all of it at once at mount.
Confirmed the remaining flakiness is pre-existing worker contention, not
a regression, by running the full suite with `--workers=1`: passes
reliably and noticeably faster per test than any parallel run.

### Room decor is original and deliberately modest

`components/office/office-decor.ts` draws walls (as wall segments split
around each door's gap, not stroked rects with a mask), a shared hallway
with the meeting table, and a couple of signature props per room —
bookshelf and inbox tray for the manager, an oversized monitor and server
rack for the engineer, a larger bookshelf for the researcher, an easel
and plant for the designer. This is iconographic, not a tile-art
recreation of the reference image — see the scope note above.

### What this didn't do

No character redesign (see above — a deliberate, stated scope call, not
an oversight). No true pathfinding — `pathTo`'s waypoints are a fixed,
hand-designed route per zone pair, not a general navmesh; this holds as
long as the room graph stays this simple (one hallway, one door per
room). No multi-floor buildings (proposal's Phase 5, unrelated). No real
tool registry — still the one piece of the original Phase 3 proposal
scope left unbuilt.

## 19. Tool registry: calculator, text file generation, structured output — done

The last piece of `product-proposal.md` §7's MVP tool list (web search,
calculator, text file generation, structured JSON output, internal
knowledge retrieval — the last one wasn't asked for and stays unbuilt).
Same discipline as the web-search milestone: concrete typed hooks per
tool, not a dynamic registry — "avoid a generic multi-tool permission
system" has been the stated position since that milestone, and four
concrete tools still doesn't change that math.

### Calculator: a hand-written parser, not `eval`

`lib/ai/tools/calculator.ts`'s `calculate()` is a small recursive-descent
parser (`+ - * / % ( )`, unary sign, decimals) — deliberately not
`eval()`/`new Function()`, which would let a model-controlled string
execute arbitrary JavaScript. Pure and fully unit-tested, including
injection-shaped input (`"process.exit()"`, `"1; DROP TABLE users;"`)
that should throw rather than do anything.

### Text file generation needed a table `docs/architecture.md` had already named

The Phase 2 schema comment has said "Artifact... deferred to Phase 3,
when real orchestration actually needs them" since that phase — this is
that need arriving. `Artifact` (migration `20260803064914_add_artifact`)
stores generated files as plain text rows, no blob storage, matching the
tool's actual scope. `lib/ai/tools/generate-file.ts`'s `prepareTextFile()`
validates the filename against a small whitelist and caps content length —
Prisma-free, same boundary `web-search.ts` already established, with the
real `prisma.artifact.create` living in `run-task-orchestration.ts`'s hook
instead. A new `ArtifactList` component (`components/business/artifact-list.tsx`)
lists them on the business page with a real download link via a `data:`
URI — no new API route, since the Server Component already has the
content in hand.

### Structured output is a second way to *finish*, not a mid-loop tool

Unlike the other two, `submit_structured_result` doesn't get the
using_tool visual treatment. The judgment call, stated plainly rather
than left implicit: choosing an output *format* isn't "invoking a tool
right now" the way search/calculate/file-save are, and giving it the same
treatment would dilute what `using_tool` actually means. When called, it
short-circuits `performSubtaskWork()` immediately — no `tool_result`
round-trip needed, since (unlike the other three) there's no reason to
feed anything back for further reasoning. The validated `{summary, items}`
still gets flattened to plain text for `Subtask.result` — no schema
change for this one; a richer structured-data renderer is a real but
deferred follow-up, the same call this codebase has made at every prior
milestone with "what this didn't do."

### One shared helper replaced three copies of the same ~25 lines

`run-task-orchestration.ts`'s `onWebSearch` hook used to inline the
using_tool-drive / `AgentEvent`-pair / drive-back-to-working shape
directly. Adding two more tools the same way would have meant two more
copies of it; instead `createToolRunner()` parameterizes that shape once,
and each hook is now a short call into it — `onGenerateFile`'s is the
only one that does anything extra (the actual `prisma.artifact.create`,
after `run()`'s validation succeeds).

### Verified live, not just in unit tests

Unit tests mock the Anthropic client, so they prove the wiring but not
that a real model actually reaches for these tools unprompted. Ran two
real goals against a live business with real Claude/Tavily calls: one
implicitly needing arithmetic ("calculate the average of $12/$15/$18")
correctly triggered `calculator` (`(12 + 15 + 18) / 3` → `15`, `using_tool`
cycling visibly, correct event labels); one explicitly asking for a saved
file correctly triggered `generate_text_file`, persisted a real `Artifact`
row, and produced a working download link with the actual generated
content. Both exercised the full path from model tool-call through
`AgentEvent` logging to the UI, not just the mocked layer.

### What this didn't do

No internal business knowledge retrieval (proposal's own MVP list names
it, the user didn't ask for it — not everything on a wishlist is worth
building unprompted). No generic multi-tool permission system
(`ToolDefinition`/`AgentToolPermission` — still deferred, still the right
call). No structured-data UI beyond flattened text. No file types beyond
plain text, no blob/binary storage.

## 20. State visual language: icon bubbles and a carried folder — done

Picked from the options raised after the last milestone — over pushing
art fidelity further or fixing the multi-agent-overlap bug, both still
open (see §21). Closes the gap the recommendation named: the product's
whole pitch is watching agents work without reading text, but `assigned`/
`planning`/`using_tool`/`completed`/`failed` were still badge-text-only.

### An icon system, not new art per state

`components/office/state-bubble.ts` draws six small glyphs (alert,
thought, tool, check, cross, pause) as plain Pixi `Graphics` shapes —
not run through the pixel-art canvas-texture pipeline `capybara-sprite.ts`
uses. That pipeline exists to make the *character* art crisp at a fixed
grid resolution; a two-line checkmark or three dots doesn't need it, and
skipping it means these are cheap to redraw (`drawBubbleGlyph()` clears
and redraws one `Graphics` object) rather than requiring a new texture
per icon. `needs_approval` is deliberately the exception: it gets a small
carried-folder graphic instead of a bubble, matching the proposal's own
distinct language for that one state ("carry folder to manager") rather
than folding it into the generic bubble set.

### A real layout bug, caught before it shipped

First placement stacked the bubble directly above the existing badge
(`y: -54` in the sprite's local space). That clips off the top of the
canvas for the manager and engineer specifically — their `idlePosition.y`
is `50`, only 40px below their room's own wall, not enough headroom for
anything stacked above the badge. Moved beside the head instead
(`position.set(15, -28)`), which costs no extra headroom since it doesn't
extend further up than the sprite's own art already does. Caught by doing
the coordinate math before trusting a screenshot, then confirmed all six
icons live in the browser afterward — a case where reasoning about the
existing headroom constraint (established back in the room-layout
milestone) mattered more than eyeballing it.

### What this didn't do

No animation on the icons themselves (no bounce/fade-in) — they appear
and disappear with the state, which reads clearly enough at this scale
to not need more. No bubble for `working`, `waiting`, `walking_to_workstation`,
or `collaborating` — position and the walk animation already make those
legible; adding a bubble to every state would be noise, not signal.

## 21. MVP-ready UI: dark theme, real shell, simplified landing — done

Prompted by a concrete near-term goal: this project is going on a resume
site as a case study, which raises the bar from "functionally correct" to
"looks like a real product." Three pieces of direct feedback drove this
milestone: the app read like unstyled HTML/CSS rather than a professional
site; the business page should adopt the actual ChatGPT/Claude pattern
(confirmed with the user specifically — one persistent shell, not just a
visual reskin of the old dashboard-then-business-page structure); and the
theme should be dark, reversing "Slate and brass" from the first polish
pass.

### The token system from the first polish pass is what made this a one-pass job

Every component already rendered through semantic classes (`bg-surface`,
`text-ink`, `border-border`, etc.) rather than hardcoded colors. Flipping
`globals.css`'s CSS variable values re-themed almost the entire app for
free — `AgentInspector`, `ActivityFeed`, `ArtifactList`, `TaskComposer`,
`CreateBusinessForm`, every button and form, all needed zero individual
edits for the dark theme itself. The actual work was the *shell*, not
re-skinning components one by one — exactly the payoff that token system
was built for.

### One persistent shell, not a reskinned dashboard

`app/dashboard/page.tsx` is gone. `app/business/layout.tsx` is now the one
place that checks auth and fetches the business list — previously
duplicated across the dashboard and business-detail pages. It renders a
persistent `components/chrome/sidebar.tsx` (a client component using
`usePathname()` to highlight the active business, rather than threading
an active-id prop through the layout tree) alongside `{children}`.
`app/business/page.tsx` is the "blank new chat" equivalent — a welcome
screen with `CreateBusinessForm` — and `app/business/[id]/page.tsx` is
what renders when a business is selected, same as clicking a conversation
in ChatGPT loads it into the main pane. Next.js's own layout-nesting model
does the "no full-page flash when switching businesses" part for free:
`layout.tsx` doesn't re-render on `[id]` navigation, only the page
segment does.

### The business page itself: canvas dominant, composer as a chat input

`components/office/business-office.tsx` stopped using `OfficeWorkspace`
(which still fits `/demo`'s different, simpler needs unchanged) and
composes `OfficeCanvas` + `TaskComposer` + a right rail directly: the
canvas fills the main column, `TaskComposer` sits pinned at the bottom
like a chat input rather than just another stacked card, and
`AgentInspector`/`ArtifactList`/`ActivityFeed` move into a `bg-sidebar`
right rail matching the left sidebar's depth.

### A deliberate cut: `DevControlPanel` off the real page

It stays exactly where it already earned its keep, `/demo` — manual
state-override controls sitting next to a page that runs real
orchestration read like a debug build, not an MVP. This is a functional
change, not just a layout one, made and flagged explicitly during
planning rather than discovered as a side effect.

### A real e2e gap this surfaced, not just a route-rename

`tests/e2e/business.spec.ts` used to drive its persistence check by
clicking `DevControlPanel` buttons — removing that panel from the real
page broke the test's actual mechanism, not just its target URL. Fixed by
driving the same transition through `PATCH /api/agents/:id` directly
(the same route `DevControlPanel` always called under the hood), which
if anything tests the real persistence guarantee more honestly: it no
longer depends on a UI control at all, just the API contract. Needed
`AgentInspector` to expose `data-agent-id` on its root element — a small,
test-only addition — since nothing in the DOM otherwise surfaces an
agent's real id.

Also surfaced a synthetic-click timing bug of its own: the rewritten test
originally reused a `canvas.boundingBox()` captured *before* `page.reload()`,
then clicked immediately after. Pixi's `setup()` is async, so the canvas
isn't always ready for hit-testing that fast — fixed by re-fetching the
bounding box after reload and wrapping the click-and-assert in
`expect(...).toPass()` so a too-early click retries instead of failing
outright.

### What this didn't do

No mobile/responsive treatment for the new sidebar shell — desktop-first,
since this is headed for a case study viewed on a normal screen. No
changes to the office canvas's own Pixi-rendered colors — a different hue
family (warm wood vs. neutral dark gray) reads as a distinct "room"
regardless of the surrounding chrome's theme, confirmed visually rather
than assumed. No resolution of the still-open art-fidelity question or
the multi-agent-overlap bug (see below) — this milestone was scoped to
shell/theme/layout specifically.

## 22. Landing page: real waitlist and an in-depth live demo — done

The dark-shell milestone had simplified the landing page down to a bare
hero, on the assumption that "simple" meant minimal. Feedback afterward
clarified that wasn't quite right: for an MVP, "simple" meant one focused
page, not one stripped of its centerpiece — the live demo needed to come
back, get richer, and the primary call to action needed to be an actual
waitlist (a real email capture, not just a styled sign-up button), with
sign-in de-emphasized to a secondary link rather than removed.

### A real capture, not a decorative form

`WaitlistEntry` (migration `20260803101008_add_waitlist_entry`) is
deliberately not linked to `User` — most rows here will never become an
account, so forcing a relation would be modeling for a case that mostly
doesn't happen. `POST /api/waitlist` upserts with an empty `update`
rather than checking existence first: resubmitting the same email is a
success either way, not an error, which also means the response never
leaks whether an address was already on the list.

### The demo got "more in depth" by being un-simplified, not rebuilt

`DEMO_SCRIPT` (`lib/simulation/demo-script.ts`) already exercised nearly
every state in the machine — assigned, planning, `using_tool`, `collaborating`,
`needs_approval`, `completed` — across all four roles; it didn't need new
content, it needed to be back on the page and given room to be seen. The
real design decision was *how* to re-embed it: not the same
`OfficeExperience`/`OfficeWorkspace` combination `/demo` uses, which
bundles in `DevControlPanel`. A new `components/office/office-demo-preview.tsx`
auto-plays on mount (no click required — a marketing page benefits from
showing motion immediately, unlike `/demo`, which is a deliberate
utility page for a signed-in user to poke at) and renders only
`OfficeCanvas` + `AgentInspector`. Manual state-override controls have no
business being exposed to an anonymous visitor — the same reasoning that
already kept `DevControlPanel` off the real business page, applied here
for the same reason rather than re-litigated.

### What this didn't do

No admin view of waitlist entries — reading the list back (a query, or
an export) is real but deferred scope, not needed for the capture itself
to work. No rate limiting or bot protection on the waitlist endpoint —
acceptable for a portfolio piece, would need attention before any real
public traffic. Sign-up/sign-in routes are unchanged and still fully
reachable (via the secondary "Already have access? Sign in" link and
sign-in's own "Create one" link) — this de-emphasizes them on the landing
page, it doesn't gate or remove them.

## 23. Shipped: pushed to GitHub, added to the portfolio as a case study

Two commits pushed to `github.com/keonaabad/capycorp` main: one for the
pixel-art/multi-room-office/state-visual-language work, one for the tool
registry + MVP dark shell + waitlist landing page (see commit messages
for the full breakdown — split so an intermediate checkout of either
commit still typechecks and builds, not just the final state).

Also replaced the "SaaS Intelligence Dashboard" (upcoming-build)
placeholder in `keona-portfolio` (the user's real portfolio — see the
`reference-keona-portfolio-repo` memory for why that's worth saying
explicitly) with a real CapyCorp case study: role, three contributions,
architecture writeup, and two screenshots taken live from the running
app. Confirmed the portfolio still typechecks, lints, and builds before
pushing.

## 24. Recommended next steps

**Hosting — a real architectural decision, not a checklist item.** This
app cannot simply be deployed to Vercel (or any serverless host) as-is.
§14 documented this at the time it was a local-dev-scoped limitation, not
yet a blocker: task orchestration runs fire-and-forget in the same Node
process (`runTaskOrchestration`, detached from the request), relying on
that process staying alive after the response is sent. Vercel's
serverless functions do not do this — the function returns and the
process may be frozen or killed, so a task would visibly start and then
just stop mid-run. Two real paths forward, worth deciding between rather
than discovering by trial and error:

- **Host on something that keeps a long-lived Node process** (a small
  VPS, Railway, Render, Fly.io) — the current architecture works
  unmodified. Simplest path, but it's a different deployment model than
  "push to Vercel."
- **Build a real background-job system** (a queue + worker, e.g.
  BullMQ/Redis — already named as deferred-until-needed back in Phase 2)
  — works on serverless, but is real new infrastructure, not
  configuration.

Either way, hosting also needs: a real Postgres instance (the current
one is local-only — Neon/Supabase/Railway Postgres are the usual
serverless-friendly options), and the same secrets currently in local
`.env` (`DATABASE_URL`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`,
`ANTHROPIC_MODEL`, `TAVILY_API_KEY`) set in whatever host is chosen. This
needs the user's own action either way — creating accounts and entering
API keys into a hosting dashboard isn't something to do on someone's
behalf.

**Two items still open from a couple of rounds back:** pushing art
fidelity further (the user's own "this isn't the UI I pictured," never
fully resolved — procedural iteration vs. hand-authored per-pixel
sprites vs. real art is still a live decision), and the multi-agent-
overlap bug (agents sharing a destination — the meeting table, the
manager's inbox — still stack exactly on top of each other).

**Beyond those:** a real approval gate before a task runs, or moving
toward the proposal's later-phase scope (multi-business collaboration,
a building overview) now that recruiters may already be looking at the
repo and the portfolio case study.

## 25. Hosting: Vercel, via `after()` instead of a new host or a job queue — done

§24 framed hosting as a three-way fork: move to a long-lived-process
host, build real queue infrastructure for Vercel, or deploy to Vercel
and accept the fire-and-forget bug. The user wanted Vercel specifically
— it already hosts the portfolio site with git-push auto-deploy, and
matching that workflow mattered more than the theoretical simplicity of
a different host. That preference turned "which host" into "how do we
make Vercel correct," which turned out to have a real answer instead of
a compromise.

### `next/server`'s `after()` was the actual fix, not a workaround

Next here is 16.2.12 — past this session's training data, so AGENTS.md's
instruction to read `node_modules/next/dist/docs` before writing
anything applied literally, not just as boilerplate advice. That's where
`after()` turned up: stable since 15.1, it schedules a callback to run
once the response is sent, and on Vercel it's backed by `waitUntil()`,
which keeps the serverless invocation alive until the callback settles
(bounded by `maxDuration`, not by nothing). That's a real fix for the
documented failure mode, not a workaround for it — the promise no longer
depends on the Node process staying alive after the response, which was
the entire problem.

### Checked the actual limit instead of assuming a stale one

Vercel's Hobby plan used to cap functions around 10s, which would have
made `after()` useless for anything but the shortest goals. That's no
longer current: with fluid compute (default on) Hobby now gets up to
300s, Pro/Enterprise up to 800s standard or 1800s under an extended-
duration beta. `route.ts` sets `export const maxDuration = 300` —
Hobby's ceiling — with a comment pointing at raising it if real
orchestrations start approaching that on Pro.

### The swap was two lines, but it broke the unit tests for a real reason

`after()` reads request-scoped `AsyncLocalStorage` that only exists when
Next's own server handles the request. `route.test.ts` calls `POST`
directly, bypassing that machinery entirely, so `after()` threw
"called outside a request scope" — not a bug in the change, a gap in
how directly-invoked route handlers can be unit tested against it. Fixed
by mocking `next/server`'s `after` to invoke its callback immediately,
same-tick, un-awaited — close enough to "doesn't block the response" for
what these tests assert, and it kept all three orchestration-kickoff
tests meaningful instead of deleting their coverage.

### The first live deploy still 500'd — a second, unrelated gap

Env vars were all present, the build was "Ready," and account creation
still failed. Actual Vercel runtime logs (pulled via the CLI, since the
dashboard doesn't surface a stack trace inline) showed the real error:
`PrismaClientInitializationError: Prisma Client could not locate the
Query Engine for runtime "rhel-openssl-3.0.x"`. `prisma generate` had
run and produced the right binary for Vercel's platform — the binary
just never made it into the deployed function bundle. Next's build-time
file tracer (`@vercel/nft`) only follows files it can see through
static `import`/`require` analysis, and the Prisma generator's *custom*
output path (`lib/generated/prisma`, not the default
`node_modules/.prisma/client` the tracer already knows about) isn't one
of them — the `.so.node` engine file got silently dropped. Fixed with
`outputFileTracingIncludes: { "/*": ["./lib/generated/prisma/**/*"] }`
in `next.config.ts`, confirmed by inspecting the emitted `.nft.json`
trace file directly rather than trusting a green build.

### What this didn't do

Didn't add a second `DIRECT_URL` env var / Prisma `directUrl` for a
pooled-vs-direct connection split — tried it, and it broke `prisma
validate` immediately because every environment, including local dev,
would then need both URLs set. A single pooled `DATABASE_URL` (Neon or
Supabase) is enough for both runtime queries and one-off `prisma migrate
deploy` runs; revisit only if that combination actually causes problems
in practice. Didn't provision the Postgres instance, create the Vercel
project, or set env vars in its dashboard — all of that needs the user's
own accounts and is explicitly the user's action, not something to do on
their behalf (see README's new "Deploy (Vercel)" section for the exact
steps). Didn't touch the multi-agent-overlap bug or art fidelity — both
still open from §24, unrelated to hosting.
