import { describe, expect, it } from "vitest";
import {
  MEETING_TABLE_POSITION,
  ROLE_LAYOUT,
  ROOM_DOOR_POSITION,
  destinationForState,
  pathTo,
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
      MEETING_TABLE_POSITION,
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
