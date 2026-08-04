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

export const OFFICE_WIDTH = 800;
export const OFFICE_HEIGHT = 560;

/** Wall thickness and the width of the gap cut into a wall for a door. */
export const WALL_THICKNESS = 10;
export const DOOR_GAP = 60;

/** The shared hallway is the horizontal band between the two room rows. */
export const HALLWAY_TOP = 230;
export const HALLWAY_BOTTOM = 330;

export const MEETING_TABLE_POSITION: OfficePoint = { x: 400, y: 280 };

/**
 * The manager's inbox sits inside the manager's own room, at a side table
 * distinct from the manager's desk — so a `needs_approval` agent visibly
 * walks into someone else's room, not just to a generic "inbox" prop
 * floating in the hallway.
 */
export const MANAGER_INBOX_POSITION: OfficePoint = { x: 300, y: 170 };

/**
 * Fixed angle per role, used to spread agents that would otherwise
 * converge on the exact same shared point (the meeting table, the
 * manager's inbox). Role-based rather than a hash of the agent id: a
 * business always has exactly one agent per role (the 4-role starter
 * team), so this guarantees every agent present is a full 90° apart —
 * maximum, collision-proof separation for up to 4 agents. An id-hash was
 * tried first but two arbitrary ids can hash to nearby angles by chance,
 * which defeats the point. Revisit this if a business ever gets more
 * than one agent per role (the "dynamic office" roadmap item).
 */
const ROLE_ANGLE: Record<AgentRole, number> = {
  manager: 0,
  engineer: 90,
  researcher: 180,
  designer: 270,
};

export function roleOffset(role: AgentRole, radius: number): OfficePoint {
  const angle = ROLE_ANGLE[role] * (Math.PI / 180);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export interface RoomRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Each role's walled room, laid out two-up-two-down around the shared
 * hallway band (`HALLWAY_TOP`..`HALLWAY_BOTTOM`). Positions mirror the
 * original open-floor corners (manager/engineer up top, designer/researcher
 * below) so the relative geography carries over, just walled off now.
 */
export const ROOM_RECT: Record<AgentRole, RoomRect> = {
  manager: { x: 10, y: 10, width: 380, height: 220 },
  engineer: { x: 410, y: 10, width: 380, height: 220 },
  designer: { x: 10, y: 330, width: 380, height: 220 },
  researcher: { x: 410, y: 330, width: 380, height: 220 },
};

/**
 * The waypoint just inside the hallway at each room's door — the single
 * gap in the wall shared between that room and the hallway band.
 */
export const ROOM_DOOR_POSITION: Record<AgentRole, OfficePoint> = {
  manager: { x: 200, y: HALLWAY_TOP },
  engineer: { x: 600, y: HALLWAY_TOP },
  designer: { x: 200, y: HALLWAY_BOTTOM },
  researcher: { x: 600, y: HALLWAY_BOTTOM },
};

export const ROLE_LAYOUT: Record<AgentRole, RoleLayout> = {
  manager: {
    accentColor: 0x2b3a67,
    idlePosition: { x: 70, y: 50 },
    deskPosition: { x: 150, y: 120 },
  },
  engineer: {
    accentColor: 0x3f7d58,
    idlePosition: { x: 730, y: 50 },
    deskPosition: { x: 650, y: 120 },
  },
  researcher: {
    accentColor: 0x8a5a44,
    idlePosition: { x: 730, y: 510 },
    deskPosition: { x: 650, y: 450 },
  },
  designer: {
    accentColor: 0xb5563c,
    idlePosition: { x: 70, y: 510 },
    deskPosition: { x: 150, y: 450 },
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
  agent: {
    role: AgentRole;
    idlePosition: OfficePoint;
    deskPosition: OfficePoint;
  },
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
    case "collaborating": {
      const offset = roleOffset(agent.role, 14);
      return {
        x: MEETING_TABLE_POSITION.x + offset.x,
        y: MEETING_TABLE_POSITION.y + offset.y,
      };
    }
    case "needs_approval": {
      const offset = roleOffset(agent.role, 14);
      return {
        x: MANAGER_INBOX_POSITION.x + offset.x,
        y: MANAGER_INBOX_POSITION.y + offset.y,
      };
    }
  }
}

/**
 * Which walled room (or the shared hallway) a state's destination lives
 * in. Reuses `AgentRole` directly as the room-zone identifier — every
 * role already names exactly one room, so no separate enum is needed.
 */
export type OfficeZone = AgentRole | "hallway";

export function zoneForState(
  role: AgentRole,
  state: Exclude<AgentState, "paused">,
): OfficeZone {
  switch (state) {
    case "collaborating":
      return "hallway";
    case "needs_approval":
      return "manager";
    default:
      return role;
  }
}

/**
 * Builds the full sequence of points a sprite must walk through to reach
 * a state's destination without cutting through a wall — a direct single
 * point when the destination is already in the sprite's current zone
 * (the common case: most transitions stay inside one's own room), or a
 * door-hallway-door route when it isn't.
 */
export function pathTo(
  agent: {
    role: AgentRole;
    idlePosition: OfficePoint;
    deskPosition: OfficePoint;
  },
  fromZone: OfficeZone,
  toState: Exclude<AgentState, "paused">,
): OfficePoint[] {
  const toZone = zoneForState(agent.role, toState);
  const destination = destinationForState(agent, toState);

  if (fromZone === toZone) {
    return [destination];
  }

  const waypoints: OfficePoint[] = [];
  if (fromZone !== "hallway") {
    waypoints.push(ROOM_DOOR_POSITION[fromZone]);
  }
  if (toZone !== "hallway") {
    // Crossing the hallway between two rooms — pass by its center rather
    // than cutting the corner. Skipped when already starting in the
    // hallway, since that would just repeat the sprite's own position.
    if (fromZone !== "hallway") {
      waypoints.push(MEETING_TABLE_POSITION);
    }
    waypoints.push(ROOM_DOOR_POSITION[toZone]);
  }
  waypoints.push(destination);
  return waypoints;
}
