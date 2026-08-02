# CapyCorp

> Build your own AI company and watch it work.

A visual multi-agent orchestration platform, presented as a pixel-art
office staffed by tiny capybaras. This repo is currently at **Phase 1: a
static, manually-driven office prototype** — see
[`docs/product-proposal.md`](./docs/product-proposal.md) for the full
product vision and [`docs/architecture.md`](./docs/architecture.md) for
what's implemented, what's deferred, and why.

Every capybara on screen is wired to a real, strictly-typed agent state
machine (`lib/simulation/state-machine.ts`). The dev control panel drives
that state machine directly, standing in for the backend event stream a
later phase will add — the office canvas, the inspector, and the state
machine itself don't need to change when that happens.

## What's here

- Four agents (Manager, Engineer, Researcher, Designer) rendered with
  PixiJS, each with a desk, a walking animation, and a status badge
- A strict 12-state agent state machine with pause/resume, fully unit
  tested
- A dev control panel that manually triggers valid state transitions per
  agent
- Click-to-inspect: click a capybara to see its role, current state, and
  a dev-only task field
- The whole simulation isolated behind an `OfficeEventAdapter` interface
  (`lib/simulation/adapter.ts`) so a future backend-driven implementation
  can replace the local one without touching any component
- A **scripted demo** (`▶ Play scripted demo`) that plays a canned
  research → design/engineering → approval task through the same adapter
  the dev panel uses, looping automatically — proof the adapter
  abstraction holds regardless of what's driving it

## What's not here yet

No auth, no database, no real AI, no multiple businesses, no billing —
all intentionally deferred. See "Recommended next milestone" in
`docs/architecture.md`.

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test        # Vitest — state machine + script player unit tests
npm run test:e2e     # Playwright — dev panel transitions, click-to-inspect, scripted demo
```

`test:e2e` starts its own dev server on port 3100 (see
`playwright.config.ts`) so it won't conflict with a `next dev` you already
have running on 3000.

## Known limitations

- State is entirely in-memory and resets on every page load — there is no
  persistence layer yet.
- The four sprites are simple original placeholder shapes, not final
  pixel art, per the proposal's own guidance to prove the interaction
  model before investing in art.
- Movement is linear interpolation between fixed coordinates, not
  pathfinding — fine for four agents and a handful of destinations, won't
  scale as-is to a busier office.
- Vitest is pinned to `^2` rather than the latest major because Vitest 4's
  Rolldown dependency needs Node ≥20.19 and this environment runs 20.12.
  Bump it once the Node version moves.

## Recommended next milestone

The scripted demo already proves the `OfficeEventAdapter` boundary holds
client-side; it still has no persistence. The next real step is Phase 2
from the proposal: authentication, a saved `Business`/`Agent`/`Task`
model in Postgres, and a backend-backed adapter implementation — only
then does real AI orchestration (Phase 3) become worth building.
