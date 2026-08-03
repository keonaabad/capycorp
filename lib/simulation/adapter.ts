import { useSyncExternalStore } from "react";
import { createStore } from "zustand/vanilla";
import {
  createInitialRuntimeState,
  pause as pauseTransition,
  reset as resetTransition,
  resume as resumeTransition,
  setState as setStateTransition,
  type AgentRuntimeState,
  type AgentState,
  type TransitionResult,
} from "./state-machine";
import {
  DEFAULT_AGENT_NAMES,
  DEMO_ROSTER,
  ROLE_LAYOUT,
  type AgentRole,
  type OfficePoint,
} from "./office-layout";

export interface AgentSnapshot extends AgentRuntimeState {
  id: string;
  name: string;
  role: AgentRole;
  accentColor: number;
  idlePosition: OfficePoint;
  deskPosition: OfficePoint;
  task: string | null;
}

export interface OfficeSnapshot {
  agents: Record<string, AgentSnapshot>;
  selectedAgentId: string | null;
  /** Agent ids with an in-flight state-mutating request against them. */
  pendingAgentIds: ReadonlySet<string>;
  /** Most recent failed command, if any — cleared on the next success. */
  lastError: { agentId: string; message: string } | null;
}

/**
 * The office simulation only ever talks to this interface, never to the
 * state machine or a data source directly. `createLocalOfficeAdapter`
 * implements it with a local, manually-driven store (Phase 1).
 * `createBackendOfficeAdapter` implements it by reading/writing through API
 * routes backed by Postgres (Phase 2). Both resolve their mutators
 * asynchronously — required for the backend adapter's network round trip,
 * and harmless for the local adapter, which just resolves immediately.
 */
export interface OfficeEventAdapter {
  /** Stable display order for this adapter's roster; never changes mid-session. */
  readonly agentOrder: readonly string[];
  getSnapshot(): OfficeSnapshot;
  subscribe(listener: () => void): () => void;
  setAgentState(agentId: string, to: AgentState): Promise<TransitionResult>;
  pauseAgent(agentId: string): Promise<TransitionResult>;
  resumeAgent(agentId: string): Promise<TransitionResult>;
  /** Starts a fresh lifecycle for an idle/completed/failed agent. See state-machine.ts reset(). */
  resetAgent(agentId: string): Promise<TransitionResult>;
  setAgentTask(agentId: string, task: string | null): void;
  selectAgent(agentId: string | null): void;
}

/**
 * Only implemented by the backend adapter — the local adapter has no
 * server to sync from. Lets a caller (e.g. a polling loop watching a live
 * task run) push server-observed agent state into the store without going
 * through the command methods above, which are for user-initiated writes.
 */
export interface BackendOfficeAdapter extends OfficeEventAdapter {
  syncAgentsFromServer(
    agents: readonly {
      id: string;
      state: AgentState;
      resumeState: AgentState | null;
      currentTask: string | null;
    }[],
  ): void;
}

function buildAgentSnapshot(
  id: string,
  role: AgentRole,
  name: string,
  runtime: AgentRuntimeState,
  task: string | null,
): AgentSnapshot {
  const layout = ROLE_LAYOUT[role];
  return {
    id,
    name,
    role,
    accentColor: layout.accentColor,
    idlePosition: layout.idlePosition,
    deskPosition: layout.deskPosition,
    task,
    ...runtime,
  };
}

function initialLocalSnapshot(): OfficeSnapshot {
  const agents: Record<string, AgentSnapshot> = {};
  for (const { id, role } of DEMO_ROSTER) {
    agents[id] = buildAgentSnapshot(
      id,
      role,
      DEFAULT_AGENT_NAMES[role],
      createInitialRuntimeState(),
      null,
    );
  }
  return {
    agents,
    selectedAgentId: null,
    pendingAgentIds: new Set(),
    lastError: null,
  };
}

export function createLocalOfficeAdapter(): OfficeEventAdapter {
  const store = createStore<OfficeSnapshot>(() => initialLocalSnapshot());
  const agentOrder = DEMO_ROSTER.map((entry) => entry.id);

  function applyTransition(
    agentId: string,
    transition: (runtime: AgentRuntimeState) => TransitionResult,
  ): TransitionResult {
    const current = store.getState().agents[agentId];
    if (!current) {
      return { ok: false, reason: `Unknown agent id "${agentId}".` };
    }
    const result = transition(current);
    if (result.ok) {
      store.setState((snapshot) => ({
        ...snapshot,
        agents: {
          ...snapshot.agents,
          [agentId]: { ...snapshot.agents[agentId], ...result.state },
        },
        lastError: null,
      }));
    } else {
      store.setState((snapshot) => ({
        ...snapshot,
        lastError: { agentId, message: result.reason },
      }));
    }
    return result;
  }

  return {
    agentOrder,
    getSnapshot: () => store.getState(),
    subscribe: (listener) => store.subscribe(listener),
    setAgentState: (agentId, to) =>
      Promise.resolve(
        applyTransition(agentId, (runtime) => setStateTransition(runtime, to)),
      ),
    pauseAgent: (agentId) =>
      Promise.resolve(applyTransition(agentId, pauseTransition)),
    resumeAgent: (agentId) =>
      Promise.resolve(applyTransition(agentId, resumeTransition)),
    resetAgent: (agentId) =>
      Promise.resolve(applyTransition(agentId, resetTransition)),
    setAgentTask: (agentId, task) => {
      store.setState((snapshot) => {
        const agent = snapshot.agents[agentId];
        if (!agent) return snapshot;
        return {
          ...snapshot,
          agents: { ...snapshot.agents, [agentId]: { ...agent, task } },
        };
      });
    },
    selectAgent: (agentId) => {
      store.setState((snapshot) => ({ ...snapshot, selectedAgentId: agentId }));
    },
  };
}

export interface BackendAgentSeed {
  id: string;
  name: string;
  role: AgentRole;
  state: AgentState;
  resumeState: AgentState | null;
  currentTask: string | null;
}

interface AgentPatchResponse {
  state: AgentState;
  resumeState: AgentState | null;
  currentTask: string | null;
}

const SET_TASK_DEBOUNCE_MS = 400;

/**
 * Reads/writes agent state through `PATCH /api/agents/:id` instead of an
 * in-memory store. Seeded synchronously from server-fetched rows so first
 * paint never shows an empty office. State-mutating commands are never
 * optimistic — the store only reflects the server's confirmed response,
 * per docs/architecture.md's "frontend must never invent progress" rule.
 * `setAgentTask` is the one deliberate exception: it updates the store
 * immediately and debounces the network write, since task text isn't
 * consistency-critical the way state transitions are, and the alternative
 * is a network request per keystroke.
 */
export function createBackendOfficeAdapter(
  businessId: string,
  initialAgents: readonly BackendAgentSeed[],
): BackendOfficeAdapter {
  void businessId; // not needed by any request below (agent id alone identifies the row), kept for callers' clarity
  const agentOrder = initialAgents.map((agent) => agent.id);
  const store = createStore<OfficeSnapshot>(() => {
    const agents: Record<string, AgentSnapshot> = {};
    for (const agent of initialAgents) {
      agents[agent.id] = buildAgentSnapshot(
        agent.id,
        agent.role,
        agent.name,
        { current: agent.state, resumeState: agent.resumeState },
        agent.currentTask,
      );
    }
    return {
      agents,
      selectedAgentId: null,
      pendingAgentIds: new Set(),
      lastError: null,
    };
  });

  const taskDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function setPending(agentId: string, pending: boolean) {
    store.setState((snapshot) => {
      const next = new Set(snapshot.pendingAgentIds);
      if (pending) next.add(agentId);
      else next.delete(agentId);
      return { ...snapshot, pendingAgentIds: next };
    });
  }

  function recordError(agentId: string, message: string) {
    store.setState((snapshot) => ({
      ...snapshot,
      lastError: { agentId, message },
    }));
  }

  async function runAction(
    agentId: string,
    body: Record<string, unknown>,
  ): Promise<TransitionResult> {
    if (!store.getState().agents[agentId]) {
      return { ok: false, reason: `Unknown agent id "${agentId}".` };
    }

    setPending(agentId, true);
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const reason =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof (payload as { error: unknown }).error === "string"
            ? (payload as { error: string }).error
            : `Request failed with status ${response.status}.`;
        recordError(agentId, reason);
        return { ok: false, reason };
      }

      const result = payload as Partial<AgentPatchResponse> | null;
      if (!result || typeof result.state !== "string") {
        const reason = "Malformed response from server.";
        recordError(agentId, reason);
        return { ok: false, reason };
      }

      const nextRuntime: AgentRuntimeState = {
        current: result.state,
        resumeState: result.resumeState ?? null,
      };
      store.setState((snapshot) => ({
        ...snapshot,
        agents: {
          ...snapshot.agents,
          [agentId]: { ...snapshot.agents[agentId], ...nextRuntime },
        },
        lastError: null,
      }));
      return { ok: true, state: nextRuntime };
    } catch {
      const reason = "Network error — could not reach the server.";
      recordError(agentId, reason);
      return { ok: false, reason };
    } finally {
      setPending(agentId, false);
    }
  }

  return {
    agentOrder,
    getSnapshot: () => store.getState(),
    subscribe: (listener) => store.subscribe(listener),
    setAgentState: (agentId, to) =>
      runAction(agentId, { action: "setState", to }),
    pauseAgent: (agentId) => runAction(agentId, { action: "pause" }),
    resumeAgent: (agentId) => runAction(agentId, { action: "resume" }),
    resetAgent: (agentId) => runAction(agentId, { action: "reset" }),
    setAgentTask: (agentId, task) => {
      store.setState((snapshot) => {
        const agent = snapshot.agents[agentId];
        if (!agent) return snapshot;
        return {
          ...snapshot,
          agents: { ...snapshot.agents, [agentId]: { ...agent, task } },
        };
      });

      const pendingTimer = taskDebounceTimers.get(agentId);
      if (pendingTimer) clearTimeout(pendingTimer);
      taskDebounceTimers.set(
        agentId,
        setTimeout(() => {
          taskDebounceTimers.delete(agentId);
          fetch(`/api/agents/${agentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "setTask", task }),
          }).catch(() => {
            recordError(agentId, "Failed to save task.");
          });
        }, SET_TASK_DEBOUNCE_MS),
      );
    },
    selectAgent: (agentId) => {
      store.setState((snapshot) => ({ ...snapshot, selectedAgentId: agentId }));
    },
    syncAgentsFromServer: (serverAgents) => {
      store.setState((snapshot) => {
        let changed = false;
        const agents = { ...snapshot.agents };
        for (const serverAgent of serverAgents) {
          const existing = agents[serverAgent.id];
          if (!existing) continue;
          if (
            existing.current === serverAgent.state &&
            existing.resumeState === serverAgent.resumeState &&
            existing.task === serverAgent.currentTask
          ) {
            continue;
          }
          changed = true;
          agents[serverAgent.id] = {
            ...existing,
            current: serverAgent.state,
            resumeState: serverAgent.resumeState,
            task: serverAgent.currentTask,
          };
        }
        return changed ? { ...snapshot, agents } : snapshot;
      });
    },
  };
}

/**
 * React hook for reading a slice of the adapter's snapshot reactively.
 * Built on useSyncExternalStore rather than zustand/react so that
 * components depend only on the OfficeEventAdapter interface, not on
 * Zustand being the underlying implementation.
 */
export function useOfficeSnapshot<T>(
  adapter: OfficeEventAdapter,
  selector: (snapshot: OfficeSnapshot) => T,
): T {
  const getSnapshot = () => selector(adapter.getSnapshot());
  return useSyncExternalStore(adapter.subscribe, getSnapshot, getSnapshot);
}
