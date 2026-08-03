import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBackendOfficeAdapter,
  createLocalOfficeAdapter,
  type BackendAgentSeed,
} from "./adapter";
import { DEFAULT_AGENT_NAMES, ROLE_LAYOUT } from "./office-layout";

describe("createLocalOfficeAdapter", () => {
  it("seeds the fixed 4-agent roster with the expected names and positions", () => {
    const adapter = createLocalOfficeAdapter();
    expect(adapter.agentOrder).toEqual([
      "manager",
      "engineer",
      "researcher",
      "designer",
    ]);

    const snapshot = adapter.getSnapshot();
    for (const id of adapter.agentOrder) {
      const agent = snapshot.agents[id];
      expect(agent.name).toBe(DEFAULT_AGENT_NAMES[agent.role]);
      expect(agent.idlePosition).toEqual(ROLE_LAYOUT[agent.role].idlePosition);
      expect(agent.deskPosition).toEqual(ROLE_LAYOUT[agent.role].deskPosition);
      expect(agent.accentColor).toBe(ROLE_LAYOUT[agent.role].accentColor);
      expect(agent.current).toBe("idle");
    }
    expect(snapshot.agents.manager.name).toBe("Moss");
    expect(snapshot.agents.engineer.name).toBe("Hazel");
    expect(snapshot.agents.researcher.name).toBe("Wren");
    expect(snapshot.agents.designer.name).toBe("Basil");
  });

  it("resolves a valid transition and updates the snapshot", async () => {
    const adapter = createLocalOfficeAdapter();
    const result = await adapter.setAgentState("manager", "assigned");
    expect(result.ok).toBe(true);
    expect(adapter.getSnapshot().agents.manager.current).toBe("assigned");
  });

  it("resolves an invalid transition without mutating the snapshot", async () => {
    const adapter = createLocalOfficeAdapter();
    const result = await adapter.setAgentState("manager", "completed");
    expect(result.ok).toBe(false);
    expect(adapter.getSnapshot().agents.manager.current).toBe("idle");
    expect(adapter.getSnapshot().lastError?.agentId).toBe("manager");
  });

  it("selectAgent and setAgentTask update the snapshot", () => {
    const adapter = createLocalOfficeAdapter();
    adapter.selectAgent("engineer");
    adapter.setAgentTask("engineer", "Stub a widget");
    const snapshot = adapter.getSnapshot();
    expect(snapshot.selectedAgentId).toBe("engineer");
    expect(snapshot.agents.engineer.task).toBe("Stub a widget");
  });
});

describe("createBackendOfficeAdapter", () => {
  const seeds: BackendAgentSeed[] = [
    {
      id: "agent-1",
      name: "Moss",
      role: "manager",
      state: "idle",
      resumeState: null,
      currentTask: null,
    },
  ];

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("updates the store from the server's response on a successful command", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          state: "assigned",
          resumeState: null,
          currentTask: null,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createBackendOfficeAdapter("biz-1", seeds);
    const result = await adapter.setAgentState("agent-1", "assigned");

    expect(result).toEqual({
      ok: true,
      state: { current: "assigned", resumeState: null },
    });
    expect(adapter.getSnapshot().agents["agent-1"].current).toBe("assigned");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents/agent-1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("leaves the store untouched on a 409 rejection and records the error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid transition." }), {
        status: 409,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createBackendOfficeAdapter("biz-1", seeds);
    const result = await adapter.setAgentState("agent-1", "completed");

    expect(result.ok).toBe(false);
    expect(adapter.getSnapshot().agents["agent-1"].current).toBe("idle");
    expect(adapter.getSnapshot().lastError).toEqual({
      agentId: "agent-1",
      message: "Invalid transition.",
    });
  });

  it("debounces rapid setAgentTask calls into a single fetch", () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createBackendOfficeAdapter("biz-1", seeds);
    adapter.setAgentTask("agent-1", "a");
    adapter.setAgentTask("agent-1", "ab");
    adapter.setAgentTask("agent-1", "abc");

    // Optimistic update happens immediately, before any debounce fires.
    expect(adapter.getSnapshot().agents["agent-1"].task).toBe("abc");
    expect(fetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agents/agent-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ action: "setTask", task: "abc" }),
      }),
    );
  });

  describe("syncAgentsFromServer", () => {
    it("updates matching agents' runtime fields", () => {
      const adapter = createBackendOfficeAdapter("biz-1", seeds);
      adapter.syncAgentsFromServer([
        {
          id: "agent-1",
          state: "working",
          resumeState: null,
          currentTask: "Researching pricing",
        },
      ]);

      const agent = adapter.getSnapshot().agents["agent-1"];
      expect(agent.current).toBe("working");
      expect(agent.task).toBe("Researching pricing");
    });

    it("ignores unknown agent ids", () => {
      const adapter = createBackendOfficeAdapter("biz-1", seeds);
      expect(() =>
        adapter.syncAgentsFromServer([
          {
            id: "not-a-real-agent",
            state: "working",
            resumeState: null,
            currentTask: null,
          },
        ]),
      ).not.toThrow();
      expect(adapter.getSnapshot().agents["agent-1"].current).toBe("idle");
    });

    it("no-ops (doesn't notify subscribers) when nothing actually changed", () => {
      const adapter = createBackendOfficeAdapter("biz-1", seeds);
      const listener = vi.fn();
      adapter.subscribe(listener);

      adapter.syncAgentsFromServer([
        { id: "agent-1", state: "idle", resumeState: null, currentTask: null },
      ]);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
