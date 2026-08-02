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
import { AGENTS } from "./office-layout";

export interface AgentSnapshot extends AgentRuntimeState {
  id: string;
  task: string | null;
}

export interface OfficeSnapshot {
  agents: Record<string, AgentSnapshot>;
  selectedAgentId: string | null;
}

/**
 * The office simulation only ever talks to this interface, never to the
 * state machine or a data source directly. Phase 1 implements it with a
 * local, manually-driven store (see createLocalOfficeAdapter). A later
 * phase can add a second implementation that derives the same snapshot
 * shape from a backend SSE event stream without touching the renderer,
 * the dev control panel, or the inspector.
 */
export interface OfficeEventAdapter {
  getSnapshot(): OfficeSnapshot;
  subscribe(listener: () => void): () => void;
  setAgentState(agentId: string, to: AgentState): TransitionResult;
  pauseAgent(agentId: string): TransitionResult;
  resumeAgent(agentId: string): TransitionResult;
  /** Starts a fresh lifecycle for an idle/completed/failed agent. See state-machine.ts reset(). */
  resetAgent(agentId: string): TransitionResult;
  setAgentTask(agentId: string, task: string | null): void;
  selectAgent(agentId: string | null): void;
}

function initialSnapshot(): OfficeSnapshot {
  const agents: Record<string, AgentSnapshot> = {};
  for (const agent of AGENTS) {
    agents[agent.id] = {
      id: agent.id,
      task: null,
      ...createInitialRuntimeState(),
    };
  }
  return { agents, selectedAgentId: null };
}

export function createLocalOfficeAdapter(): OfficeEventAdapter {
  const store = createStore<OfficeSnapshot>(() => initialSnapshot());

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
      }));
    }
    return result;
  }

  return {
    getSnapshot: () => store.getState(),
    subscribe: (listener) => store.subscribe(listener),
    setAgentState: (agentId, to) =>
      applyTransition(agentId, (runtime) => setStateTransition(runtime, to)),
    pauseAgent: (agentId) => applyTransition(agentId, pauseTransition),
    resumeAgent: (agentId) => applyTransition(agentId, resumeTransition),
    resetAgent: (agentId) => applyTransition(agentId, resetTransition),
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
