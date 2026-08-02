# CapyCorp

> Build your own AI company and watch it work.

A visual multi-agent orchestration platform, presented as a pixel-art
office staffed by tiny capybaras. This repo is currently partway through
**Phase 2** (auth and persistence landed; the office simulation still
runs on the local in-memory adapter, not yet wired to the database) — see
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
- **Email/password authentication** (Auth.js Credentials provider, bcrypt
  hashing, JWT sessions) gating the office page — sign up, sign in, sign
  out all work against a real Postgres-backed `User` table
- A migrated Prisma schema (`User`/`Business`/`Agent`/`Task`/`AgentEvent`)
  — the tables exist and are ready, but nothing in the UI reads or writes
  them yet (see "What's not here yet")

## What's not here yet

The office simulation still runs entirely on the local, in-memory
`OfficeEventAdapter` — signing in doesn't yet change what you see. No
business/agent/task CRUD, no activity timeline reading from
`AgentEvent`, no real AI, no billing. See "Recommended next milestone"
below.

## Run locally

Requires Node 20+ and a local PostgreSQL instance.

**1. Database** — create a dedicated role and database (adjust the
password):

```sql
CREATE ROLE capycorp_app WITH LOGIN PASSWORD 'your-password' CREATEDB;
CREATE DATABASE capycorp OWNER capycorp_app;
```

**2. Environment** — create `.env` in the project root:

```bash
DATABASE_URL="postgresql://capycorp_app:your-password@localhost:5432/capycorp?schema=public"
AUTH_SECRET="<openssl rand -base64 32>"
```

**3. Install, migrate, run:**

```bash
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create an
account.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test        # Vitest — state machine + script player unit tests
npm run test:e2e     # Playwright — auth flow, dev panel transitions, click-to-inspect, scripted demo
```

`test:e2e` starts its own dev server on port 3100 (see
`playwright.config.ts`) so it won't conflict with a `next dev` you already
have running on 3000. It runs against the same database as `npm run dev`
and creates its own test account (`e2e@example.com`) on first run.

## Known limitations

- The office simulation's state is entirely in-memory and resets on every
  page load — auth and the database are live, but nothing about a
  session's businesses/agents/tasks persists yet.
- The four sprites are simple original placeholder shapes, not final
  pixel art, per the proposal's own guidance to prove the interaction
  model before investing in art.
- Movement is linear interpolation between fixed coordinates, not
  pathfinding — fine for four agents and a handful of destinations, won't
  scale as-is to a busier office.
- Vitest and Prisma are both pinned below their latest majors (Vitest
  `^2`, Prisma `^6`) because their newest versions require Node ≥20.19
  and this environment runs 20.12. Bump both once the Node version moves.

## Recommended next milestone

Wire the office simulation to the database: a business-selection screen
backed by real `Business` rows, agents created from the `AgentRole`
templates already in the schema, and a backend `OfficeEventAdapter`
implementation that reads/writes through API routes instead of an
in-memory store. The scripted demo and dev panel stay useful throughout
as fixtures once that adapter exists. Only after that does real AI
orchestration (Phase 3) become worth building.
