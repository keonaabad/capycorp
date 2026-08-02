import type { AgentState } from "./state-machine";

export interface ScriptStep {
  atMs: number;
  agentId: string;
  /** If set, calls adapter.setAgentState(agentId, state). */
  state?: AgentState;
  /** If set (including null), calls adapter.setAgentTask(agentId, task). */
  task?: string | null;
}

export const DEMO_TASK_BRIEF =
  "Research three competitors, compare pricing, and ship a positioning brief.";

/**
 * A scripted stand-in for a real backend event stream. Mirrors the
 * "Example interaction" walkthrough in docs/product-proposal.md, adapted
 * to this build's actual four-agent roster (manager, engineer, researcher,
 * designer) rather than the proposal's illustrative manager/researcher/
 * analyst example.
 */
export const DEMO_SCRIPT: readonly ScriptStep[] = [
  // Manager receives the brief and starts planning.
  { atMs: 0, agentId: "manager", state: "assigned", task: DEMO_TASK_BRIEF },
  { atMs: 700, agentId: "manager", state: "walking_to_workstation" },
  { atMs: 1500, agentId: "manager", state: "planning" },
  {
    atMs: 2600,
    agentId: "manager",
    state: "working",
    task: "Delegating research, design, and engineering subtasks.",
  },

  // Manager hands out three subtasks at once.
  {
    atMs: 3300,
    agentId: "researcher",
    state: "assigned",
    task: "Research three competitors and compare pricing.",
  },
  {
    atMs: 3300,
    agentId: "designer",
    state: "assigned",
    task: "Sketch a comparison layout for the brief.",
  },
  {
    atMs: 3300,
    agentId: "engineer",
    state: "assigned",
    task: "Stub a pricing calculator widget.",
  },
  { atMs: 4000, agentId: "researcher", state: "walking_to_workstation" },
  { atMs: 4000, agentId: "designer", state: "walking_to_workstation" },
  { atMs: 4000, agentId: "engineer", state: "walking_to_workstation" },
  { atMs: 4700, agentId: "researcher", state: "planning" },
  { atMs: 4700, agentId: "designer", state: "planning" },
  { atMs: 4700, agentId: "engineer", state: "planning" },
  { atMs: 5400, agentId: "researcher", state: "working" },
  { atMs: 5400, agentId: "designer", state: "working" },
  { atMs: 5400, agentId: "engineer", state: "working" },

  // Researcher uses a tool, then hands findings to the designer.
  {
    atMs: 6800,
    agentId: "researcher",
    state: "using_tool",
    task: "Searching competitor pricing pages.",
  },
  { atMs: 8200, agentId: "researcher", state: "working" },
  { atMs: 8900, agentId: "researcher", state: "collaborating" },
  { atMs: 8900, agentId: "designer", state: "collaborating" },
  { atMs: 10100, agentId: "researcher", state: "working" },
  {
    atMs: 10100,
    agentId: "designer",
    state: "working",
    task: "Incorporating competitor findings into the layout.",
  },

  // Engineer finishes first and needs approval.
  {
    atMs: 11200,
    agentId: "engineer",
    state: "needs_approval",
    task: "Pricing calculator stub ready for review.",
  },
  {
    atMs: 12500,
    agentId: "engineer",
    state: "completed",
    task: "Pricing calculator approved.",
  },

  // Designer finishes next.
  {
    atMs: 13200,
    agentId: "designer",
    state: "needs_approval",
    task: "Comparison layout ready for review.",
  },
  {
    atMs: 14500,
    agentId: "designer",
    state: "completed",
    task: "Layout approved.",
  },

  // Researcher wraps up.
  {
    atMs: 15200,
    agentId: "researcher",
    state: "completed",
    task: "Competitor research delivered.",
  },

  // Manager assembles the final brief.
  {
    atMs: 16400,
    agentId: "manager",
    state: "needs_approval",
    task: "Final positioning brief ready for the user.",
  },
  {
    atMs: 17700,
    agentId: "manager",
    state: "completed",
    task: "Positioning brief shipped.",
  },
] as const;

export const DEMO_SCRIPT_DURATION_MS = Math.max(
  ...DEMO_SCRIPT.map((step) => step.atMs),
);
