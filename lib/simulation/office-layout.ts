import type { AgentState } from "./state-machine";

export interface OfficePoint {
  x: number;
  y: number;
}

export type AgentRole = "manager" | "engineer" | "researcher" | "designer";

export interface AgentDefinition {
  id: string;
  name: string;
  role: AgentRole;
  /** Placeholder role accent color, expressed as a Pixi-style hex number. */
  accentColor: number;
  /** Where the agent stands when idle, away from their desk. */
  idlePosition: OfficePoint;
  /** The agent's own workstation. */
  deskPosition: OfficePoint;
}

export const OFFICE_WIDTH = 720;
export const OFFICE_HEIGHT = 440;

export const MEETING_TABLE_POSITION: OfficePoint = { x: 360, y: 260 };
export const MANAGER_INBOX_POSITION: OfficePoint = { x: 120, y: 130 };

export const AGENTS: readonly AgentDefinition[] = [
  {
    id: "manager",
    name: "Moss",
    role: "manager",
    accentColor: 0x2b3a67,
    idlePosition: { x: 90, y: 70 },
    deskPosition: { x: 120, y: 130 },
  },
  {
    id: "engineer",
    name: "Hazel",
    role: "engineer",
    accentColor: 0x3f7d58,
    idlePosition: { x: 630, y: 70 },
    deskPosition: { x: 590, y: 140 },
  },
  {
    id: "researcher",
    name: "Wren",
    role: "researcher",
    accentColor: 0x8a5a44,
    idlePosition: { x: 630, y: 380 },
    deskPosition: { x: 590, y: 330 },
  },
  {
    id: "designer",
    name: "Basil",
    role: "designer",
    accentColor: 0xb5563c,
    idlePosition: { x: 90, y: 380 },
    deskPosition: { x: 140, y: 330 },
  },
] as const;

export function getAgentDefinition(agentId: string): AgentDefinition {
  const agent = AGENTS.find((candidate) => candidate.id === agentId);
  if (!agent) {
    throw new Error(`Unknown agent id "${agentId}".`);
  }
  return agent;
}

/**
 * Where an agent's sprite should stand for a given state. "paused" is
 * intentionally excluded: a paused agent freezes wherever it already is
 * rather than snapping to a new destination.
 */
export function destinationForState(
  agent: AgentDefinition,
  state: Exclude<AgentState, "paused">,
): OfficePoint {
  switch (state) {
    case "idle":
    case "assigned":
      return agent.idlePosition;
    case "walking_to_workstation":
    case "planning":
    case "working":
    case "using_tool":
    case "waiting":
    case "completed":
    case "failed":
      return agent.deskPosition;
    case "collaborating":
      return MEETING_TABLE_POSITION;
    case "needs_approval":
      return MANAGER_INBOX_POSITION;
  }
}
