export const AGENT_STATES = [
  "idle",
  "assigned",
  "walking_to_workstation",
  "planning",
  "working",
  "using_tool",
  "waiting",
  "collaborating",
  "needs_approval",
  "completed",
  "failed",
  "paused",
] as const;

export type AgentState = (typeof AGENT_STATES)[number];

/** Human-readable label for each state — shared between the office canvas and any other UI that displays agent state. */
export const STATE_LABEL: Record<AgentState, string> = {
  idle: "idle",
  assigned: "assigned",
  walking_to_workstation: "heading to desk",
  planning: "planning",
  working: "working",
  using_tool: "using a tool",
  waiting: "waiting",
  collaborating: "collaborating",
  needs_approval: "needs approval",
  completed: "completed",
  failed: "failed",
  paused: "paused",
};

export interface AgentRuntimeState {
  current: AgentState;
  /** State to return to on resume(); only set while current === "paused". */
  resumeState: AgentState | null;
}

export type TransitionResult =
  { ok: true; state: AgentRuntimeState } | { ok: false; reason: string };

const TERMINAL_STATES: ReadonlySet<AgentState> = new Set([
  "completed",
  "failed",
]);

/** States an agent may be paused from. Idle and the terminal states are excluded. */
const PAUSABLE_STATES: ReadonlySet<AgentState> = new Set([
  "assigned",
  "walking_to_workstation",
  "planning",
  "working",
  "using_tool",
  "waiting",
  "collaborating",
  "needs_approval",
]);

/** Allowed forward transitions, mirroring the agent execution lifecycle. */
const TRANSITIONS: Record<AgentState, readonly AgentState[]> = {
  idle: ["assigned"],
  assigned: ["walking_to_workstation", "failed"],
  walking_to_workstation: ["planning", "failed"],
  planning: ["working", "failed"],
  working: [
    "using_tool",
    "waiting",
    "collaborating",
    "needs_approval",
    "completed",
    "failed",
  ],
  using_tool: ["working", "failed"],
  waiting: ["working", "failed"],
  collaborating: ["working", "failed"],
  needs_approval: ["working", "completed", "failed"],
  completed: [],
  failed: [],
  // paused has no forward transitions of its own; resume() restores resumeState instead.
  paused: [],
};

export function createInitialRuntimeState(): AgentRuntimeState {
  return { current: "idle", resumeState: null };
}

export function isTerminal(state: AgentState): boolean {
  return TERMINAL_STATES.has(state);
}

export function canTransition(from: AgentState, to: AgentState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Move to an explicit next state. Rejects transitions while paused; use resume() first. */
export function setState(
  runtime: AgentRuntimeState,
  to: AgentState,
): TransitionResult {
  if (runtime.current === "paused") {
    return {
      ok: false,
      reason: `Agent is paused; call resume() before transitioning to "${to}".`,
    };
  }
  if (!canTransition(runtime.current, to)) {
    return {
      ok: false,
      reason: `Invalid transition: "${runtime.current}" -> "${to}".`,
    };
  }
  return { ok: true, state: { current: to, resumeState: null } };
}

export function pause(runtime: AgentRuntimeState): TransitionResult {
  if (runtime.current === "paused") {
    return { ok: false, reason: "Agent is already paused." };
  }
  if (!PAUSABLE_STATES.has(runtime.current)) {
    return {
      ok: false,
      reason: `Cannot pause an agent in state "${runtime.current}".`,
    };
  }
  return {
    ok: true,
    state: { current: "paused", resumeState: runtime.current },
  };
}

export function resume(runtime: AgentRuntimeState): TransitionResult {
  if (runtime.current !== "paused" || !runtime.resumeState) {
    return { ok: false, reason: "Agent is not paused." };
  }
  return {
    ok: true,
    state: { current: runtime.resumeState, resumeState: null },
  };
}

/**
 * Start a fresh lifecycle. Unlike setState(), this is not a step in the
 * forward transition graph — idle has no incoming edges there, since
 * nothing should be able to rewind an in-progress agent back to idle.
 * reset() is the explicit, named exception: an agent that is already
 * idle or has finished (completed/failed) a task may be handed a new one.
 * An agent that is actively working, paused, etc. must finish or fail
 * first — reset() will not interrupt it.
 */
export function reset(runtime: AgentRuntimeState): TransitionResult {
  if (runtime.current !== "idle" && !isTerminal(runtime.current)) {
    return {
      ok: false,
      reason: `Cannot reset an agent mid-task (state "${runtime.current}"); let it complete or fail first.`,
    };
  }
  return { ok: true, state: createInitialRuntimeState() };
}
