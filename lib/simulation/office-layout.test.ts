import { describe, expect, it } from "vitest";
import {
  MANAGER_INBOX_POSITION,
  MEETING_TABLE_POSITION,
  ROLE_LAYOUT,
  ROOM_DOOR_POSITION,
  destinationForState,
  pathTo,
  roleOffset,
  zoneForState,
} from "./office-layout";

const manager = { role: "manager" as const, ...ROLE_LAYOUT.manager };
const engineer = { role: "engineer" as const, ...ROLE_LAYOUT.engineer };

describe("zoneForState", () => {
  it("resolves most states to the agent's own room", () => {
    expect(zoneForState("engineer", "idle")).toBe("engineer");
    expect(zoneForState("engineer", "working")).toBe("engineer");
    expect(zoneForState("engineer", "completed")).toBe("engineer");
  });

  it("resolves collaborating to the hallway", () => {
    expect(zoneForState("designer", "collaborating")).toBe("hallway");
  });

  it("resolves needs_approval to the manager's room regardless of role", () => {
    expect(zoneForState("engineer", "needs_approval")).toBe("manager");
    expect(zoneForState("manager", "needs_approval")).toBe("manager");
  });
});

describe("pathTo", () => {
  it("returns a direct single-point path when already in the destination zone", () => {
    const path = pathTo(engineer, "engineer", "working");
    expect(path).toEqual([destinationForState(engineer, "working")]);
  });

  it("routes through its own door and the hallway center when leaving its room for a hallway destination", () => {
    const path = pathTo(engineer, "engineer", "collaborating");
    expect(path).toEqual([
      ROOM_DOOR_POSITION.engineer,
      destinationForState(engineer, "collaborating"),
    ]);
  });

  it("routes directly from the hallway into a room without repeating the hallway center", () => {
    const path = pathTo(engineer, "hallway", "needs_approval");
    expect(path).toEqual([
      ROOM_DOOR_POSITION.manager,
      destinationForState(engineer, "needs_approval"),
    ]);
  });

  it("routes through both doors and the hallway center when crossing between two different rooms", () => {
    const path = pathTo(engineer, "engineer", "needs_approval");
    expect(path).toEqual([
      ROOM_DOOR_POSITION.engineer,
      MEETING_TABLE_POSITION,
      ROOM_DOOR_POSITION.manager,
      destinationForState(engineer, "needs_approval"),
    ]);
  });

  it("takes the manager directly to their own inbox without a hallway detour", () => {
    const path = pathTo(manager, "manager", "needs_approval");
    expect(path).toEqual([destinationForState(manager, "needs_approval")]);
  });
});

describe("destinationForState overlap offset", () => {
  it("gives every role a distinct point at the shared meeting table, at least 90 degrees apart", () => {
    const points = (
      ["manager", "engineer", "researcher", "designer"] as const
    ).map((role) =>
      destinationForState({ role, ...ROLE_LAYOUT[role] }, "collaborating"),
    );
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dist = Math.hypot(
          points[i].x - points[j].x,
          points[i].y - points[j].y,
        );
        // Adjacent roles are 90 degrees apart on a 14px-radius circle —
        // the minimum possible separation between any two of the four.
        expect(dist).toBeGreaterThanOrEqual(14 * Math.SQRT2 - 0.01);
      }
    }
    expect(points[0]).not.toEqual(MEETING_TABLE_POSITION);
  });

  it("gives every role a distinct point at the shared manager inbox", () => {
    const a = destinationForState(manager, "needs_approval");
    const b = destinationForState(engineer, "needs_approval");
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(MANAGER_INBOX_POSITION);
  });

  it("is stable across repeated calls for the same agent (no flicker)", () => {
    expect(destinationForState(engineer, "collaborating")).toEqual(
      destinationForState(engineer, "collaborating"),
    );
  });

  it("roleOffset stays within the requested radius", () => {
    const offset = roleOffset("researcher", 14);
    expect(Math.hypot(offset.x, offset.y)).toBeCloseTo(14, 5);
  });
});
