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

## 11. Recommended next milestone

The scripted stream proves the adapter boundary; it still runs entirely
client-side with no persistence. The next real step is Phase 2 from the
proposal: authentication, a saved `Business`/`Agent`/`Task` model in
Postgres, and swapping `createLocalOfficeAdapter()` for one backed by
actual API routes — at which point the scripted demo becomes a useful
fixture for local development and tests rather than the only data source.
