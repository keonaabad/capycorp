import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const businessFindUniqueMock = vi.fn();
const runTaskOrchestrationMock = vi.fn();

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("./run-task-orchestration", () => ({
  runTaskOrchestration: runTaskOrchestrationMock,
  NON_MANAGER_ROLES: ["engineer", "researcher", "designer"],
}));
// after() needs the request-scoped AsyncLocalStorage that only exists when
// Next's server actually handles the request — absent here since these
// tests call POST directly. Stand in with a same-tick, un-awaited call:
// close enough to "runs without blocking the response" for these tests.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (fn: () => unknown) => fn() };
});

interface AgentRecord {
  id: string;
  businessId: string;
  role: "manager" | "engineer" | "researcher" | "designer";
  state: string;
  resumeState: string | null;
  currentTask: string | null;
}

function makeAgents(businessId: string): AgentRecord[] {
  return [
    {
      id: "agent-manager",
      businessId,
      role: "manager",
      state: "idle",
      resumeState: null,
      currentTask: null,
    },
    {
      id: "agent-engineer",
      businessId,
      role: "engineer",
      state: "idle",
      resumeState: null,
      currentTask: null,
    },
    {
      id: "agent-researcher",
      businessId,
      role: "researcher",
      state: "idle",
      resumeState: null,
      currentTask: null,
    },
    {
      id: "agent-designer",
      businessId,
      role: "designer",
      state: "idle",
      resumeState: null,
      currentTask: null,
    },
  ];
}

function createPrismaMock(agents: AgentRecord[]) {
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  let taskSeq = 0;
  const agentUpdate = vi.fn(
    (args: { where: { id: string }; data: Partial<AgentRecord> }) => {
      const agent = agentMap.get(args.where.id);
      if (!agent) throw new Error("unknown agent in test mock");
      Object.assign(agent, args.data);
      return Promise.resolve({ ...agent });
    },
  );

  const prisma = {
    business: { findUnique: businessFindUniqueMock },
    agent: { update: agentUpdate },
    agentEvent: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        agent: { update: agentUpdate },
        agentEvent: { create: vi.fn().mockResolvedValue({}) },
      }),
    ),
    task: {
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        taskSeq += 1;
        return Promise.resolve({ id: `task-${taskSeq}`, ...args.data });
      }),
    },
  };

  return { prisma, agentMap };
}

let currentPrismaMock: ReturnType<typeof createPrismaMock>;
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return currentPrismaMock.prisma;
  },
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/businesses/biz-1/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "biz-1" }) };

describe("POST /api/businesses/[id]/tasks", () => {
  beforeEach(() => {
    authMock.mockReset();
    businessFindUniqueMock.mockReset();
    runTaskOrchestrationMock.mockReset();
    runTaskOrchestrationMock.mockResolvedValue({
      status: "completed",
      subtaskResults: [],
    });
    authMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("returns 202 with a taskId immediately, without waiting for orchestration", async () => {
    const agents = makeAgents("biz-1");
    currentPrismaMock = createPrismaMock(agents);
    businessFindUniqueMock.mockResolvedValue({
      id: "biz-1",
      userId: "user-1",
      agents,
    });
    // Orchestration never resolves during this test — proves POST doesn't await it.
    runTaskOrchestrationMock.mockReturnValue(new Promise(() => {}));

    const response = await POST(
      makeRequest({ goal: "Ship a pricing page" }),
      ctx,
    );
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.taskId).toMatch(/^task-/);
  });

  it("kicks off orchestration with the manager and role-mapped agents", async () => {
    const agents = makeAgents("biz-1");
    currentPrismaMock = createPrismaMock(agents);
    businessFindUniqueMock.mockResolvedValue({
      id: "biz-1",
      userId: "user-1",
      agents,
    });

    await POST(makeRequest({ goal: "Ship a pricing page" }), ctx);

    expect(runTaskOrchestrationMock).toHaveBeenCalledTimes(1);
    const [taskId, manager, agentsByRole, goal] =
      runTaskOrchestrationMock.mock.calls[0];
    expect(taskId).toMatch(/^task-/);
    expect(manager.id).toBe("agent-manager");
    expect(agentsByRole.get("engineer").id).toBe("agent-engineer");
    expect(goal).toBe("Ship a pricing page");
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const response = await POST(
      makeRequest({ goal: "Ship a pricing page" }),
      ctx,
    );
    expect(response.status).toBe(401);
    expect(runTaskOrchestrationMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the business belongs to a different user", async () => {
    const agents = makeAgents("biz-1");
    currentPrismaMock = createPrismaMock(agents);
    businessFindUniqueMock.mockResolvedValue({
      id: "biz-1",
      userId: "someone-else",
      agents,
    });

    const response = await POST(
      makeRequest({ goal: "Ship a pricing page" }),
      ctx,
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 when goal is missing", async () => {
    const agents = makeAgents("biz-1");
    currentPrismaMock = createPrismaMock(agents);
    businessFindUniqueMock.mockResolvedValue({
      id: "biz-1",
      userId: "user-1",
      agents,
    });

    const response = await POST(makeRequest({}), ctx);
    expect(response.status).toBe(400);
    expect(runTaskOrchestrationMock).not.toHaveBeenCalled();
  });

  it("passes freshly-reset (not stale) agent state to orchestration for a second run", async () => {
    // Regression test: agents left over as "completed" from a prior run
    // must be reset to "idle" in memory too, not just persisted to the
    // DB — runTaskOrchestration's first transition (idle -> assigned) is
    // illegal from a stale "completed" snapshot.
    const agents = makeAgents("biz-1");
    for (const agent of agents) agent.state = "completed";
    currentPrismaMock = createPrismaMock(agents);
    businessFindUniqueMock.mockResolvedValue({
      id: "biz-1",
      userId: "user-1",
      agents,
    });

    await POST(makeRequest({ goal: "Ship a pricing page" }), ctx);

    const [, manager, agentsByRole] = runTaskOrchestrationMock.mock.calls[0];
    expect(manager.state).toBe("idle");
    expect(agentsByRole.get("engineer").state).toBe("idle");
    // The persisted DB state must match what orchestration was handed.
    expect(currentPrismaMock.agentMap.get("agent-manager")?.state).toBe("idle");
  });

  it("returns 409 when a task is already running", async () => {
    const agents = makeAgents("biz-1");
    agents[0].state = "working";
    currentPrismaMock = createPrismaMock(agents);
    businessFindUniqueMock.mockResolvedValue({
      id: "biz-1",
      userId: "user-1",
      agents,
    });

    const response = await POST(
      makeRequest({ goal: "Ship a pricing page" }),
      ctx,
    );
    expect(response.status).toBe(409);
    expect(runTaskOrchestrationMock).not.toHaveBeenCalled();
  });
});
