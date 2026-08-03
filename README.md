# CapyCorp

> Build your own AI company and watch it work.

A visual multi-agent orchestration platform, presented as a pixel-art
office staffed by tiny capybaras. Submit a goal in plain language and a
real Claude-driven manager plans it, delegates it to the right agents,
and — as of the latest milestone — those agents can search the real web
to do the work. See [`docs/product-proposal.md`](./docs/product-proposal.md)
for the full product vision and [`docs/architecture.md`](./docs/architecture.md)
for what's implemented, what's deferred, and why (every milestone has its
own dated write-up with the reasoning behind each tradeoff).

Every capybara on screen is wired to a real, strictly-typed agent state
machine (`lib/simulation/state-machine.ts`). The same pure transition
functions drive both a human clicking the dev control panel and Claude
planning autonomously — one state machine, two drivers, reused
server-side via `lib/server/agent-transitions.ts`.

## What's here

- **Real AI orchestration**: submit a goal, a manager agent (Claude, forced
  tool-use for structured output) breaks it into subtasks per relevant
  role, and each agent does the work — including a real Tavily-backed
  `web_search` tool the model can call multiple times per subtask
- **Watch it happen live**: task runs execute detached from the request
  and the browser polls for state every ~1.5s, so agents visibly walk,
  plan, work, search (`using_tool`), and complete in real time
- Four agents (Manager, Engineer, Researcher, Designer) per business,
  rendered with PixiJS, each with a desk, a walking animation, and a
  status badge
- A strict 12-state agent state machine with pause/resume, fully unit
  tested
- Email/password authentication (Auth.js Credentials, bcrypt, JWT
  sessions), a business list (create/archive/select), and agents created
  from role templates on business creation — all persisted to Postgres
- A dev control panel that manually triggers valid state transitions per
  agent, and a `/demo` page with the original Phase 1.5 scripted
  research→design/engineering→approval demo, both still useful as
  fixtures
- The whole simulation isolated behind an `OfficeEventAdapter` interface
  (`lib/simulation/adapter.ts`) — a local in-memory implementation backs
  `/demo`, a Postgres-backed implementation backs real businesses, and
  neither the canvas, the inspector, nor the dev panel know which one
  they're talking to

## What's not here yet

A real tool registry beyond web search (calculator, file generation), a
human approval gate before a task runs, task cancellation mid-run, an
activity-timeline UI reading back the `AgentEvent` history that's already
being written, multi-floor buildings for more than one business at a
time, and SSE (live updates are polling-based by deliberate choice — see
`docs/architecture.md`'s write-up on why). See that doc's own
"recommended next milestone" section for what's next, since it's kept
current as milestones land.

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

# Real AI orchestration — get a key at console.anthropic.com. Pay-as-you-go,
# separate from any Claude.ai subscription.
ANTHROPIC_API_KEY="sk-ant-..."
# A current Claude model id from your Anthropic console's model list —
# deliberately no default here; verify it yourself rather than trust a
# guessed string that may be stale.
ANTHROPIC_MODEL="claude-..."

# Real web search tool — get a free-tier key at tavily.com, no billing
# required. Without this, submitting a goal that needs research will
# fail once the model tries to call web_search.
TAVILY_API_KEY="tvly-..."
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

- The four sprites are simple original placeholder shapes, not final
  pixel art, per the proposal's own guidance to prove the interaction
  model before investing in art.
- Movement is linear interpolation between fixed coordinates, not
  pathfinding — fine for four agents and a handful of destinations, won't
  scale as-is to a busier office.
- A task run executes fire-and-forget on the server, detached from the
  request that started it — this relies on a long-lived Node process
  (`next dev`/`next start`), not serverless. A production deploy (e.g.
  Vercel) would need a real background-job system instead. Local dev
  only, by design, for now.
- Vitest and Prisma are both pinned below their latest majors (Vitest
  `^2`, Prisma `^6`) because their newest versions require Node ≥20.19
  and this environment runs 20.12. Bump both once the Node version moves.

## Recommended next milestone

See `docs/architecture.md`'s own "recommended next milestone" section —
it's updated every time a milestone lands rather than duplicated here.
