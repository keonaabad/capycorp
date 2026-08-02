# CapyCorp: AI Agent Ecosystem

## Full Product Proposal and Build Plan

## 1. Product Summary

**CapyCorp** is a beginner-friendly AI agent orchestration platform presented as a living pixel-art business ecosystem.

Each user owns one or more businesses. Every business is represented as its own office floor containing tiny capybara employees. The capybaras are visual representations of AI agents such as a manager, engineer, researcher, designer, analyst, marketer, and QA specialist.

Users assign goals in normal language, then watch the capybaras divide the work, move around the office, collaborate, use tools, produce artifacts, and report progress in real time.

The office is not merely decorative. It is the primary interface for understanding what each agent is doing.

### Core pitch

> Build your own AI company and watch it work.

### Portfolio pitch

> A full-stack multi-agent orchestration platform with real-time event streaming, persistent agent memory, tool execution, workflow visualization, and an interactive pixel-art simulation interface.

---

## 2. Product Vision

Most AI agent platforms expose complex logs, graphs, and configuration panels. This makes them difficult for beginners to understand.

CapyCorp translates invisible AI activity into a visual system:

- An agent receiving a task becomes a capybara picking up a folder.
- An agent starting work becomes a capybara walking to its desk.
- Collaboration becomes one capybara visiting another.
- A tool call becomes a visit to a specialized room.
- Waiting becomes an idle animation.
- Failure becomes a visible warning state.
- Completion becomes a delivered folder and a finished artifact.

The long-term product becomes a visual operating system for users who run multiple businesses or projects with AI assistance.

---

## 3. Target Users

### Primary users

- Solo founders
- Small SaaS operators
- Indie hackers
- Freelancers and agencies
- Creators managing several projects
- Beginners interested in AI automation
- Developers experimenting with agent orchestration

### Portfolio audience

- Software engineering recruiters
- AI engineering recruiters
- Startup founders
- Engineering managers
- Potential collaborators

---

## 4. Main Product Model

### User ecosystem

Each account owns an ecosystem containing businesses.

### Business

A business is an isolated workspace with:

- Its own name and industry
- Its own office floor
- Its own agents
- Its own tasks and workflows
- Its own files and knowledge
- Its own connected tools
- Its own activity history

### Building behavior

- One business: show a complete single-floor office rather than an empty tower.
- Two or more businesses: represent them as floors in a shared building.
- Users switch floors using an elevator control or building overview.
- Agents can later collaborate across floors through shared service agents.

### Agent

Each agent has:

- Name
- Role
- Avatar appearance
- Personality traits
- System instructions
- Skills
- Tool permissions
- Current state
- Assigned task
- Persistent memory
- Business membership

### Task

Each task has:

- User goal
- Business
- Assigned agents
- Plan and subtasks
- Status
- Priority
- Inputs
- Outputs
- Activity events
- Approval requirements
- Cost and usage metadata

---

## 5. Product Identity and Visual Direction

### Visual style

- Original 2D pixel art
- Cozy professional office
- Small capybaras with role-specific outfits
- Clean modern application chrome surrounding the office
- Friendly but not childish
- Restrained palette
- Clear typography
- Smooth transitions and readable status indicators

### Character examples

- Manager: suit and tie
- Engineer: hoodie, laptop, headphones
- Designer: turtleneck, sketchbook
- Researcher: glasses, notebook
- Analyst: formal shirt, charts
- QA specialist: magnifying glass or checklist
- Marketer: blazer, clipboard

### Important originality rule

The product may use a pixel-office concept, but it must not copy another product's:

- Sprites
- Floor plan
- Animations
- Assets
- Branding
- Interface layout
- Character designs

All art and interaction patterns should be original.

---

## 6. Core User Experience

## Onboarding

1. User creates an account.
2. User names the first business.
3. User chooses an industry or selects a blank workspace.
4. User chooses a starter team.
5. The first office is generated.
6. A short tutorial asks the user to submit one task.
7. The task appears physically in the office.
8. Agents begin working.

## Main screen

The main screen contains:

- Pixel-art office canvas
- Current business name
- Task composer
- Business or floor switcher
- Agent status summary
- Activity panel
- Deliverables panel
- Controls for pause, resume, and approve

## Example interaction

User enters:

> Research three competitors, compare their pricing, and produce a short positioning recommendation.

The system:

1. Manager agent receives the task.
2. Manager creates subtasks.
3. Researcher walks to the research desk.
4. Analyst waits for the research output.
5. Researcher completes findings and carries a folder to the analyst.
6. Analyst creates a comparison.
7. Manager reviews the final recommendation.
8. User receives the completed report.

---

## 7. MVP Scope

The MVP must prove that the interface represents real agent activity rather than playing disconnected animations.

### MVP features

#### Authentication

- Email authentication or OAuth
- User account
- Persistent sessions

#### Businesses

- Create a business
- Rename a business
- Switch between businesses
- Delete or archive a business

#### Agents

- Create agents from role templates
- Edit agent name and instructions
- Activate or deactivate agents
- Display current state

#### Tasks

- Submit a goal in natural language
- Assign a manager agent
- Generate a simple plan
- Create subtasks
- Run agents sequentially or with limited parallelism
- Pause and resume execution
- Cancel a task
- Display final output

#### Office simulation

- One original office layout
- Four to six agent sprites
- Walking animation
- Idle animation
- Working animation
- Carrying-folder animation
- Success animation
- Error or confused animation
- Clickable agents
- Agent state mapped to office behavior

#### Real-time updates

- Stream task events to the frontend
- Update agent state without refreshing
- Synchronize activity panel and sprite behavior

#### Persistence

- Save businesses
- Save agents
- Save tasks
- Save subtasks
- Save agent messages
- Save event history
- Save generated artifacts

#### Basic tool system

Initial safe tools:

- Web search or mock research tool
- Calculator
- Text file generation
- Structured JSON output
- Internal business knowledge retrieval

For the earliest local build, tools may be mocked so the orchestration and event system can be completed first.

---

## 8. Features Explicitly Deferred Until After MVP

Do not include these in the first release unless the MVP is already stable:

- Cross-business agent collaboration
- Entire city view
- Economy or revenue simulation
- Mobile-native application
- Real-time multiplayer
- Marketplace for agents
- Arbitrary code execution
- Autonomous financial transactions
- Unrestricted browser control
- Voice interaction
- Custom office editor
- Large-scale multi-agent swarms
- Complex billing
- Dozens of office themes

---

## 9. Recommended Technical Stack

### Frontend

- Next.js
- TypeScript
- React
- Tailwind CSS
- Zustand for local simulation and interface state
- TanStack Query for server data
- PixiJS or Phaser for the office simulation

### Backend

- Next.js route handlers for initial MVP, or a separate Node.js service if needed
- PostgreSQL
- Prisma ORM
- Redis for queues, locks, and transient state
- BullMQ for background jobs

### Real-time transport

Choose one:

- Server-Sent Events for simpler one-way task updates
- WebSockets for richer bidirectional interaction

Recommendation for MVP: **Server-Sent Events** unless the simulation later requires bidirectional socket traffic.

### AI layer

- Provider abstraction supporting one initial model provider
- Structured outputs for plans, subtasks, and agent actions
- Tool-call validation
- Usage tracking
- Retry and timeout handling

### Storage

- Local filesystem during early development
- S3-compatible object storage for production artifacts

### Testing

- Vitest for unit tests
- Playwright for end-to-end tests
- Optional Cypress only if preferred

### Deployment

- Vercel for frontend and lightweight API routes
- Railway, Render, Fly.io, or similar for workers and Redis-backed jobs
- Managed PostgreSQL

---

## 10. System Architecture

```text
Browser
  |
  |-- Next.js UI
  |     |-- Office simulation
  |     |-- Task composer
  |     |-- Activity timeline
  |     |-- Agent inspector
  |
  |-- API layer
        |-- Authentication
        |-- Business service
        |-- Agent service
        |-- Task service
        |-- Event stream
        |
        |-- Orchestrator
              |-- Planner
              |-- Scheduler
              |-- Agent runtime
              |-- Tool registry
              |-- Memory service
              |-- Artifact service
              |-- Event publisher
        |
        |-- PostgreSQL
        |-- Redis / BullMQ
        |-- Object storage
        |-- LLM provider
```

---

## 11. Agent Runtime Design

Each agent execution should follow a controlled loop.

### Agent execution lifecycle

1. Receive a subtask.
2. Load relevant context.
3. Load allowed tools.
4. Request a structured action from the model.
5. Validate the action.
6. Execute the tool or produce an output.
7. Save the result.
8. Publish events.
9. Decide whether the subtask is complete.
10. Return control to the orchestrator.

### Agent states

Use a strict state machine:

- `idle`
- `assigned`
- `walking_to_workstation`
- `planning`
- `working`
- `using_tool`
- `waiting`
- `collaborating`
- `needs_approval`
- `completed`
- `failed`
- `paused`

The frontend simulation must render behavior from these states.

### Critical rule

The frontend must never invent task progress. It should animate only from backend events or clearly marked cosmetic idle behavior.

---

## 12. Event System

The backend publishes normalized domain events.

### Example events

- `task.created`
- `task.started`
- `task.paused`
- `task.completed`
- `task.failed`
- `subtask.created`
- `subtask.assigned`
- `agent.state_changed`
- `agent.message_created`
- `agent.tool_started`
- `agent.tool_completed`
- `agent.handoff_started`
- `agent.handoff_completed`
- `artifact.created`
- `approval.requested`
- `approval.resolved`

### Example event payload

```json
{
  "id": "evt_123",
  "type": "agent.state_changed",
  "businessId": "biz_123",
  "taskId": "task_123",
  "agentId": "agent_123",
  "timestamp": "2026-08-02T18:00:00.000Z",
  "data": {
    "from": "assigned",
    "to": "walking_to_workstation",
    "destination": "engineering_desk"
  }
}
```

---

## 13. Initial Database Model

### User

- id
- email
- name
- image
- createdAt
- updatedAt

### Business

- id
- userId
- name
- industry
- description
- officeTheme
- floorOrder
- createdAt
- updatedAt

### Agent

- id
- businessId
- name
- role
- instructions
- personality
- spriteKey
- workstationKey
- status
- modelConfig
- createdAt
- updatedAt

### Task

- id
- businessId
- title
- goal
- status
- priority
- createdBy
- startedAt
- completedAt
- createdAt
- updatedAt

### Subtask

- id
- taskId
- assignedAgentId
- title
- description
- status
- order
- dependsOn
- result
- createdAt
- updatedAt

### AgentMessage

- id
- taskId
- subtaskId
- agentId
- role
- content
- metadata
- createdAt

### AgentEvent

- id
- businessId
- taskId
- agentId
- type
- data
- createdAt

### Artifact

- id
- taskId
- createdByAgentId
- type
- title
- content
- storageUrl
- metadata
- createdAt

### ToolDefinition

- id
- key
- name
- description
- schema
- riskLevel
- enabled

### AgentToolPermission

- id
- agentId
- toolDefinitionId
- enabled

---

## 14. Pixel Office Implementation

### Rendering engine

Use PixiJS if the goal is a lightweight custom simulation integrated into React.

Use Phaser if the product needs more built-in game mechanics such as pathfinding, scenes, cameras, and animation systems.

Recommendation: **PixiJS for the MVP**.

### Scene structure

- Floor background
- Walls and windows
- Desks
- Workstations
- Meeting area
- Manager desk
- Research station
- Delivery or inbox area
- Elevator door
- Decorative props
- Agent sprites
- Status bubbles
- Selection highlight

### Movement

For MVP:

- Use predefined walkable paths or a simple grid.
- Give every workstation a destination coordinate.
- Use basic path interpolation.
- Avoid complex collision physics.

Later:

- Add A* pathfinding.
- Add congestion avoidance.
- Add richer room layouts.

### Animation-state mapping

| Backend state          | Visual behavior                               |
| ---------------------- | --------------------------------------------- |
| idle                   | standing, sitting, coffee, or breathing loop  |
| assigned               | alert bubble appears                          |
| walking_to_workstation | walk to target desk                           |
| planning               | thinking bubble or whiteboard animation       |
| working                | typing or writing animation                   |
| using_tool             | move to specialized station or show tool icon |
| waiting                | seated waiting animation                      |
| collaborating          | walk to another agent or meeting table        |
| needs_approval         | carry folder to manager or user inbox         |
| completed              | deliver output and celebrate briefly          |
| failed                 | error bubble and confused animation           |

---

## 15. UI Layout

### Desktop layout

```text
+--------------------------------------------------------------+
| Business switcher | Current task | Usage | Profile           |
+---------------------------------------------+----------------+
|                                             | Agent / Task   |
|                                             | Inspector      |
|              Pixel Office Canvas            |                |
|                                             | Activity Feed  |
|                                             |                |
+---------------------------------------------+----------------+
| Task composer | Pause | Resume | Approvals | Deliverables    |
+--------------------------------------------------------------+
```

### Main components

- `BusinessSwitcher`
- `BuildingOverview`
- `OfficeCanvas`
- `TaskComposer`
- `TaskTimeline`
- `AgentInspector`
- `AgentRoster`
- `ApprovalDrawer`
- `ArtifactViewer`
- `ActivityFeed`
- `UsageIndicator`

### Beginner-friendly principles

- Default templates instead of blank configuration forms
- Plain-language statuses
- Tooltips explaining agent roles
- Guided onboarding
- Visible pause and cancel controls
- Clear distinction between thinking, acting, and waiting
- No raw chain-of-thought display
- Advanced settings hidden behind an expandable section

---

## 16. Security and Safety

### MVP restrictions

- No arbitrary shell execution
- No unrestricted file-system access
- No autonomous purchases
- No sending external messages without approval
- No connecting sensitive accounts without explicit consent
- Validate all tool inputs
- Apply per-tool permissions
- Rate-limit task creation
- Store secrets only in encrypted server-side configuration
- Sanitize rendered model output
- Use signed URLs for private artifacts

### Approval system

Actions may be classified as:

- Safe and automatic
- Review recommended
- User approval required
- Prohibited

The MVP should require approval before any external side effect.

---

## 17. Development Phases

## Phase 0: Product specification and setup

Estimated time: 1-2 days

Deliverables:

- Finalize product name
- Create repository
- Configure TypeScript, linting, formatting, and tests
- Set up Next.js and database
- Create a basic design system
- Define event schemas and state machine

## Phase 1: Static office prototype

Estimated time: 3-5 days

Deliverables:

- Render one office
- Display four capybara agents
- Click agents to open an inspector
- Trigger local state changes manually
- Demonstrate walking, working, waiting, success, and failure animations

Goal:

Prove the visual concept before integrating AI.

## Phase 2: Businesses, agents, and tasks

Estimated time: 4-6 days

Deliverables:

- Authentication
- Create and switch businesses
- Create agents from templates
- Create tasks
- Persist data
- Show activity timeline

## Phase 3: Real orchestration

Estimated time: 5-8 days

Deliverables:

- Planner agent
- Subtask generation
- Agent assignment
- Controlled agent loop
- Model provider abstraction
- Structured outputs
- Basic tool registry
- Event publishing

## Phase 4: Real-time simulation synchronization

Estimated time: 3-5 days

Deliverables:

- SSE event stream
- Backend-driven sprite states
- Handoffs between agents
- Final artifacts
- Pause, resume, cancel

## Phase 5: Multi-business building

Estimated time: 3-5 days

Deliverables:

- Building view
- Floor switcher
- One business per floor
- Single-business mode remains one full office
- Persistent floor order

## Phase 6: Polish and portfolio readiness

Estimated time: 5-7 days

Deliverables:

- Responsive UI
- Improved animations
- Error states
- Loading states
- Seeded demo account
- End-to-end tests
- Landing page
- Architecture diagram
- README
- Demo video
- Deployment

### Total realistic timeline

- Functional MVP: approximately 3-4 weeks
- Strong portfolio version: approximately 5-7 weeks
- Production-grade commercial version: several additional months

---

## 18. MVP Acceptance Criteria

The MVP is complete when a new user can:

1. Create an account.
2. Create a business.
3. Add at least three agents.
4. Submit a natural-language task.
5. Watch the manager create subtasks.
6. Watch capybaras move and change behavior based on real backend events.
7. Inspect each agent's current task and status.
8. See at least one agent hand work to another.
9. Pause or cancel the workflow.
10. Receive a saved final artifact.
11. Refresh the page without losing task history.
12. Create a second business and switch floors.

---

## 19. Portfolio Presentation

### Project description

> CapyCorp is a visual multi-agent orchestration platform where users create AI-powered businesses and watch pixel-art capybara agents collaborate in real time. I built the agent runtime, task planning system, event-driven simulation, persistent memory, tool permissions, and full-stack interface.

### Technical highlights

- Event-driven architecture
- Multi-agent task orchestration
- Structured LLM outputs
- Background job processing
- Real-time streaming
- Persistent task and event history
- Pixel-art simulation synchronized with backend state
- Multi-tenant business workspaces
- Human approval controls

### Demo flow

1. Create a business.
2. Show the office and agents.
3. Submit a clear task.
4. Watch the manager delegate it.
5. Show capybaras moving and collaborating.
6. Inspect live event data.
7. Open the final artifact.
8. Switch to another business floor.
9. Briefly show the architecture diagram.

---

## 20. Risks and Mitigations

### Risk: Building too many features

Mitigation:

- Lock the MVP scope.
- Build one office and one orchestration flow first.
- Defer marketplace, city, economy, and custom layouts.

### Risk: Pixel art consumes too much time

Mitigation:

- Start with simple original placeholder sprites.
- Use a limited animation set.
- Improve art only after the system works.

### Risk: Agent output is inconsistent

Mitigation:

- Use strict schemas.
- Keep roles narrow.
- Add retries and validation.
- Use deterministic mock agents during UI development.

### Risk: The visual simulation becomes disconnected from reality

Mitigation:

- Drive all meaningful animation from backend events.
- Label decorative idle animations separately.

### Risk: Cost grows quickly

Mitigation:

- Add task limits.
- Use smaller models for planning and routing.
- Cache repeated context.
- Track token and tool usage.

### Risk: Recruiters interpret it as only a game

Mitigation:

- Include an architecture view.
- Show real task logs and artifacts.
- Explain the event system and agent runtime in the README and demo.

---

## 21. Suggested Repository Structure

```text
capycorp/
  apps/
    web/
      app/
      components/
      features/
      lib/
      public/
        sprites/
        office/
    worker/
      src/
        orchestrator/
        agents/
        tools/
        jobs/
  packages/
    database/
    shared/
    events/
    ai/
    config/
    ui/
  prisma/
  tests/
  docs/
    architecture.md
    event-model.md
    agent-runtime.md
  docker-compose.yml
  package.json
  README.md
```

A single Next.js repository is acceptable for Phase 1. Split the worker only when background execution is introduced.

---

## 22. First Claude Code Build Instruction

Paste the following into Claude Code after creating an empty repository:

```text
We are building CapyCorp, a full-stack AI agent orchestration platform represented as a living pixel-art office staffed by tiny capybaras.

Before writing significant code, read the attached product proposal and create:

1. A concise implementation plan.
2. An architecture decision record covering:
   - Next.js application structure
   - PostgreSQL and Prisma
   - PixiJS office simulation
   - Zustand and TanStack Query
   - Server-Sent Events
   - Redis and BullMQ, deferred until the orchestration phase
3. A phased task checklist that keeps the first milestone limited to a static interactive office prototype.
4. A proposed directory structure.
5. A list of technical risks and assumptions.

Then implement only Phase 0 and Phase 1:

- Initialize a modern Next.js TypeScript project.
- Add Tailwind CSS, linting, formatting, Vitest, and Playwright.
- Add PixiJS.
- Build one original pixel-office scene using placeholder programmatic shapes or original local assets.
- Render four capybara agent placeholders.
- Implement a strict frontend agent state machine with these states:
  idle, assigned, walking_to_workstation, planning, working, using_tool, waiting, collaborating, needs_approval, completed, failed, paused.
- Add a developer control panel that manually changes agent states.
- Animate agent movement between predefined office destinations.
- Add click-to-inspect behavior showing agent name, role, current state, and current task.
- Keep the office simulation isolated behind a clean adapter so it can later consume backend domain events.
- Add unit tests for the state machine.
- Add one Playwright test that loads the office and changes an agent state.
- Write setup instructions in the README.

Do not add real AI, authentication, a database, Redis, billing, multiple businesses, or external integrations yet.

Prioritize clean architecture, strict typing, readable code, and a working visual prototype over feature count. After implementation, summarize all files created, commands to run, tests performed, known limitations, and the exact recommended next milestone.
```

---

## 23. Recommended First Milestone

The first milestone should not be an AI agent platform yet.

It should be:

> A polished interactive pixel office in which four capybara agents move between destinations and visibly respond to a strict state machine.

Once that feels good, connect it to a deterministic fake event stream. Only after the event pipeline works should real AI orchestration be added.

This order prevents the project from becoming an unstable combination of unfinished AI logic and unfinished game animation.

---

## 24. Final Product Principle

CapyCorp succeeds only if the visual layer explains the underlying system.

The capybaras should make complex agent behavior understandable, not hide it.

The final experience should feel like watching a tiny company operate while still giving advanced users access to the tasks, events, tool calls, artifacts, and architecture behind the simulation.
