import { beforeEach, describe, expect, it, vi } from "vitest";

const planTaskMock = vi.fn();
const performSubtaskWorkMock = vi.fn();

vi.mock("@/lib/ai/planner", () => ({ planTask: planTaskMock }));
vi.mock("@/lib/ai/perform-subtask", () => ({
  performSubtaskWork: performSubtaskWorkMock,
}));

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

/** A minimal in-memory Prisma stand-in tracking agent/task/subtask state as orchestration mutates it. */
function createPrismaMock(agents: AgentRecord[], taskId: string) {
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const subtasks: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  let subtaskSeq = 0;
  const task: Record<string, unknown> = {
    id: taskId,
    status: "running",
    error: null,
  };

  const agentUpdate = vi.fn(
    (args: { where: { id: string }; data: Partial<AgentRecord> }) => {
      const agent = agentMap.get(args.where.id);
      if (!agent) throw new Error("unknown agent in test mock");
      Object.assign(agent, args.data);
      return Promise.resolve({ ...agent });
    },
  );
  const agentEventCreate = vi.fn((args: { data: Record<string, unknown> }) => {
    events.push(args.data);
    return Promise.resolve({ id: `evt-${events.length}`, ...args.data });
  });

  const artifacts: Record<string, unknown>[] = [];
  const artifactCreate = vi.fn((args: { data: Record<string, unknown> }) => {
    const record = { id: `artifact-${artifacts.length + 1}`, ...args.data };
    artifacts.push(record);
    return Promise.resolve(record);
  });

  const prisma = {
    agent: { update: agentUpdate },
    agentEvent: { create: agentEventCreate },
    artifact: { create: artifactCreate },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        agent: { update: agentUpdate },
        agentEvent: { create: agentEventCreate },
      }),
    ),
    task: {
      update: vi.fn((args: { data: Record<string, unknown> }) => {
        Object.assign(task, args.data);
        return Promise.resolve(task);
      }),
    },
    subtask: {
      create: vi.fn((args: { data: Record<string, unknown> }) => {
        subtaskSeq += 1;
        const record = { id: `subtask-${subtaskSeq}`, ...args.data };
        subtasks.push(record);
        return Promise.resolve(record);
      }),
      update: vi.fn(
        (args: { where: { id: string }; data: Record<string, unknown> }) => {
          const record = subtasks.find((s) => s.id === args.where.id);
          Object.assign(record as object, args.data);
          return Promise.resolve(record);
        },
      ),
    },
  };

  return {
    prisma,
    agentMap,
    getTask: () => task,
    getSubtasks: () => subtasks,
    getEvents: () => events,
    getArtifacts: () => artifacts,
  };
}

let currentPrismaMock: ReturnType<typeof createPrismaMock>;
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return currentPrismaMock.prisma;
  },
}));

const { runTaskOrchestration } = await import("./run-task-orchestration");

describe("runTaskOrchestration", () => {
  beforeEach(() => {
    planTaskMock.mockReset();
    performSubtaskWorkMock.mockReset();
  });

  it("happy path: drives every agent to completed and returns subtask results", async () => {
    const agents = makeAgents("biz-1");
    currentPrismaMock = createPrismaMock(agents, "task-1");
    const manager = agents[0];
    const agentsByRole = new Map(agents.map((a) => [a.role, a]));

    planTaskMock.mockResolvedValue([
      { role: "researcher", title: "Research pricing", description: "..." },
      { role: "engineer", title: "Build a widget", description: "..." },
    ]);
    performSubtaskWorkMock.mockResolvedValue("Done, here's a summary.");

    const result = await runTaskOrchestration(
      "task-1",
      "Acme Widgets",
      manager as never,
      agentsByRole as never,
      "Ship a pricing page",
    );

    expect(result.status).toBe("completed");
    expect(result.subtaskResults).toHaveLength(2);
    expect(result.subtaskResults.every((r) => r.ok)).toBe(true);

    expect(currentPrismaMock.agentMap.get("agent-manager")?.state).toBe(
      "completed",
    );
    expect(currentPrismaMock.agentMap.get("agent-researcher")?.state).toBe(
      "completed",
    );
    expect(currentPrismaMock.agentMap.get("agent-engineer")?.state).toBe(
      "completed",
    );
    // designer had no subtask assigned — stays idle, not a bug.
    expect(currentPrismaMock.agentMap.get("agent-designer")?.state).toBe(
      "idle",
    );
    expect(currentPrismaMock.getTask().status).toBe("completed");
  });

  it("marks the task failed with the error message when planning fails, leaving agents untouched", async () => {
    const agents = makeAgents("biz-1");
    currentPrismaMock = createPrismaMock(agents, "task-1");
    const manager = agents[0];
    const agentsByRole = new Map(agents.map((a) => [a.role, a]));

    planTaskMock.mockRejectedValue(new Error("model unavailable"));

    const result = await runTaskOrchestration(
      "task-1",
      "Acme Widgets",
      manager as never,
      agentsByRole as never,
      "Ship a pricing page",
    );

    expect(result.status).toBe("failed");
    expect(currentPrismaMock.agentMap.get("agent-manager")?.state).toBe("idle");
    expect(currentPrismaMock.getTask().status).toBe("failed");
    expect(currentPrismaMock.getTask().error).toBe("model unavailable");
  });

  it("marks the task failed overall when one subtask fails, without aborting the others", async () => {
    const agents = makeAgents("biz-1");
    currentPrismaMock = createPrismaMock(agents, "task-1");
    const manager = agents[0];
    const agentsByRole = new Map(agents.map((a) => [a.role, a]));

    planTaskMock.mockResolvedValue([
      { role: "researcher", title: "Research pricing", description: "..." },
      { role: "engineer", title: "Build a widget", description: "..." },
    ]);
    performSubtaskWorkMock.mockImplementation((subtask: { role: string }) =>
      subtask.role === "engineer"
        ? Promise.reject(new Error("tool call failed"))
        : Promise.resolve("Done, here's a summary."),
    );

    const result = await runTaskOrchestration(
      "task-1",
      "Acme Widgets",
      manager as never,
      agentsByRole as never,
      "Ship a pricing page",
    );

    expect(result.status).toBe("failed");
    expect(currentPrismaMock.agentMap.get("agent-researcher")?.state).toBe(
      "completed",
    );
    expect(currentPrismaMock.agentMap.get("agent-engineer")?.state).toBe(
      "failed",
    );

    const subtasks = currentPrismaMock.getSubtasks();
    const engineerSubtask = subtasks.find(
      (s) => (s as { agentId: string }).agentId === "agent-engineer",
    );
    expect((engineerSubtask as { status: string }).status).toBe("failed");
    const researcherSubtask = subtasks.find(
      (s) => (s as { agentId: string }).agentId === "agent-researcher",
    );
    expect((researcherSubtask as { status: string }).status).toBe("completed");
  });

  it("drives the agent through using_tool and logs tool_started/tool_completed events when a subtask searches", async () => {
    const agents = makeAgents("biz-1");
    currentPrismaMock = createPrismaMock(agents, "task-1");
    const manager = agents[0];
    const agentsByRole = new Map(agents.map((a) => [a.role, a]));

    planTaskMock.mockResolvedValue([
      { role: "researcher", title: "Research pricing", description: "..." },
    ]);
    let observedStateDuringSearch: string | undefined;
    performSubtaskWorkMock.mockImplementation(
      async (
        _subtask: unknown,
        _context: unknown,
        hooks: {
          onWebSearch: (
            q: string,
            run: () => Promise<unknown>,
          ) => Promise<unknown>;
        },
      ) => {
        await hooks.onWebSearch("competitor pricing", async () => {
          observedStateDuringSearch =
            currentPrismaMock.agentMap.get("agent-researcher")?.state;
          return [{ title: "t", url: "u", snippet: "s" }];
        });
        return "Done.";
      },
    );

    await runTaskOrchestration(
      "task-1",
      "Acme Widgets",
      manager as never,
      agentsByRole as never,
      "Ship a pricing page",
    );

    expect(observedStateDuringSearch).toBe("using_tool");
    expect(currentPrismaMock.agentMap.get("agent-researcher")?.state).toBe(
      "completed",
    );

    const events = currentPrismaMock.getEvents();
    const started = events.find(
      (e) => (e as { type: string }).type === "agent.tool_started",
    );
    const completed = events.find(
      (e) => (e as { type: string }).type === "agent.tool_completed",
    );
    expect(started).toMatchObject({
      data: { tool: "web_search", query: "competitor pricing" },
    });
    expect(completed).toMatchObject({
      data: {
        tool: "web_search",
        query: "competitor pricing",
        ok: true,
        resultCount: 1,
      },
    });
  });

  it("drives the agent through using_tool and logs events when a subtask calculates", async () => {
    const agents = makeAgents("biz-1");
    currentPrismaMock = createPrismaMock(agents, "task-1");
    const manager = agents[0];
    const agentsByRole = new Map(agents.map((a) => [a.role, a]));

    planTaskMock.mockResolvedValue([
      { role: "researcher", title: "Add up the totals", description: "..." },
    ]);
    let observedStateDuringCalculate: string | undefined;
    performSubtaskWorkMock.mockImplementation(
      async (
        _subtask: unknown,
        _context: unknown,
        hooks: {
          onCalculate: (
            expression: string,
            run: () => Promise<number>,
          ) => Promise<number>;
        },
      ) => {
        await hooks.onCalculate("2 + 2", async () => {
          observedStateDuringCalculate =
            currentPrismaMock.agentMap.get("agent-researcher")?.state;
          return 4;
        });
        return "Done.";
      },
    );

    await runTaskOrchestration(
      "task-1",
      "Acme Widgets",
      manager as never,
      agentsByRole as never,
      "Ship a pricing page",
    );

    expect(observedStateDuringCalculate).toBe("using_tool");
    expect(currentPrismaMock.agentMap.get("agent-researcher")?.state).toBe(
      "completed",
    );

    const events = currentPrismaMock.getEvents();
    const completed = events.find(
      (e) => (e as { type: string }).type === "agent.tool_completed",
    );
    expect(completed).toMatchObject({
      data: { tool: "calculator", expression: "2 + 2", ok: true, result: 4 },
    });
  });

  it("drives the agent through using_tool, persists an Artifact, and logs events when a subtask generates a file", async () => {
    const agents = makeAgents("biz-1");
    currentPrismaMock = createPrismaMock(agents, "task-1");
    const manager = agents[0];
    const agentsByRole = new Map(agents.map((a) => [a.role, a]));

    planTaskMock.mockResolvedValue([
      { role: "designer", title: "Write a summary", description: "..." },
    ]);
    let observedStateDuringSave: string | undefined;
    performSubtaskWorkMock.mockImplementation(
      async (
        _subtask: unknown,
        _context: unknown,
        hooks: {
          onGenerateFile: (
            file: { filename: string; content: string },
            run: () => Promise<{ filename: string; content: string }>,
          ) => Promise<{ filename: string; content: string }>;
        },
      ) => {
        await hooks.onGenerateFile(
          { filename: "notes.txt", content: "Some findings." },
          async () => {
            observedStateDuringSave =
              currentPrismaMock.agentMap.get("agent-designer")?.state;
            return { filename: "notes.txt", content: "Some findings." };
          },
        );
        return "Done.";
      },
    );

    await runTaskOrchestration(
      "task-1",
      "Acme Widgets",
      manager as never,
      agentsByRole as never,
      "Ship a pricing page",
    );

    expect(observedStateDuringSave).toBe("using_tool");
    expect(currentPrismaMock.agentMap.get("agent-designer")?.state).toBe(
      "completed",
    );

    const artifacts = currentPrismaMock.getArtifacts();
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      businessId: "biz-1",
      taskId: "task-1",
      agentId: "agent-designer",
      filename: "notes.txt",
      content: "Some findings.",
    });

    const events = currentPrismaMock.getEvents();
    const completed = events.find(
      (e) => (e as { type: string }).type === "agent.tool_completed",
    );
    expect(completed).toMatchObject({
      data: { tool: "generate_text_file", filename: "notes.txt", ok: true },
    });
  });
});
