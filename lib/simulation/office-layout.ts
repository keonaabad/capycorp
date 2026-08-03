import type { AgentState } from "./state-machine";

export interface OfficePoint {
  x: number;
  y: number;
}

export type AgentRole = "manager" | "engineer" | "researcher" | "designer";

export interface RoleLayout {
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

/**
 * Desk position and role accent color, keyed by role rather than by agent
 * id — every business gets one agent per role, but the id is a DB cuid, not
 * a fixed string, so layout can't be keyed by id the way Phase 1 did it.
 */
export const ROLE_LAYOUT: Record<AgentRole, RoleLayout> = {
  manager: {
    accentColor: 0x2b3a67,
    idlePosition: { x: 90, y: 70 },
    deskPosition: { x: 120, y: 130 },
  },
  engineer: {
    accentColor: 0x3f7d58,
    idlePosition: { x: 630, y: 70 },
    deskPosition: { x: 590, y: 140 },
  },
  researcher: {
    accentColor: 0x8a5a44,
    idlePosition: { x: 630, y: 380 },
    deskPosition: { x: 590, y: 330 },
  },
  designer: {
    accentColor: 0xb5563c,
    idlePosition: { x: 90, y: 380 },
    deskPosition: { x: 140, y: 330 },
  },
};

/** Stable display order for a business's 4 role-templated agents. */
export const ROLE_ORDER: readonly AgentRole[] = [
  "manager",
  "engineer",
  "researcher",
  "designer",
] as const;

/** Starter-team names assigned when a business's agents are created from templates. */
export const DEFAULT_AGENT_NAMES: Record<AgentRole, string> = {
  manager: "Moss",
  engineer: "Hazel",
  researcher: "Wren",
  designer: "Basil",
};

/**
 * The fixed 4 agent ids used by the local, non-persisted adapter (the
 * Phase 1.5 scripted demo and its tests hardcode these exact ids).
 */
export const DEMO_ROSTER: readonly { id: string; role: AgentRole }[] = [
  { id: "manager", role: "manager" },
  { id: "engineer", role: "engineer" },
  { id: "researcher", role: "researcher" },
  { id: "designer", role: "designer" },
] as const;

/**
 * Where an agent's sprite should stand for a given state. "paused" is
 * intentionally excluded: a paused agent freezes wherever it already is
 * rather than snapping to a new destination.
 */
export function destinationForState(
  agent: { idlePosition: OfficePoint; deskPosition: OfficePoint },
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
