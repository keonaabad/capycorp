import { Container, Graphics } from "pixi.js";
import {
  DOOR_GAP,
  HALLWAY_BOTTOM,
  HALLWAY_TOP,
  MANAGER_INBOX_POSITION,
  MEETING_TABLE_POSITION,
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
  ROLE_LAYOUT,
  ROOM_DOOR_POSITION,
  ROOM_RECT,
  WALL_THICKNESS,
  type AgentRole,
} from "@/lib/simulation/office-layout";

const FLOOR = 0x352c22;
const FLOOR_ALT = 0x3a3025;
const FLOOR_BORDER = 0x463a2c;
const WALL = 0x6b5638;
const WALL_TRIM = 0x2e2419;
const WOOD = 0x4a3c2d;
const WOOD_DARK = 0x2e2419;
const RUG = 0x5c3d2e;
const RUG_BORDER = 0x3c2418;
const SCREEN = 0x1c1712;
const SCREEN_GLOW = 0x6fa88a;
const PLANT_POT = 0x6b4a34;
const PLANT_LEAF = 0x4f7a4a;
const CANVAS_CREAM = 0xede6d6;
const BOOK_COLORS = [0x8a5a44, 0x3f7d58, 0xb5563c, 0x2b3a67, 0xc89a3c];

const ROLES: readonly AgentRole[] = [
  "manager",
  "engineer",
  "researcher",
  "designer",
];

function hWall(x1: number, x2: number, y: number): Graphics {
  const t = WALL_THICKNESS;
  return new Graphics()
    .rect(x1, y - t / 2, x2 - x1, t)
    .fill({ color: WALL })
    .stroke({ color: WALL_TRIM, width: 2 });
}

function vWall(y1: number, y2: number, x: number, thickness = WALL_THICKNESS) {
  return new Graphics()
    .rect(x - thickness / 2, y1, thickness, y2 - y1)
    .fill({ color: WALL })
    .stroke({ color: WALL_TRIM, width: 2 });
}

function buildDesk(x: number, y: number): Graphics {
  return new Graphics()
    .roundRect(x - 26, y - 16, 52, 32, 4)
    .fill({ color: WOOD })
    .stroke({ color: WOOD_DARK, width: 2 });
}

function buildMonitor(x: number, y: number): Graphics {
  return new Graphics()
    .roundRect(x - 14, y - 32, 28, 20, 2)
    .fill({ color: SCREEN })
    .stroke({ color: WOOD_DARK, width: 2 })
    .rect(x - 10, y - 28, 20, 12)
    .fill({ color: SCREEN_GLOW });
}

function buildBookshelf(x: number, y: number, rows = 2): Graphics {
  const g = new Graphics()
    .roundRect(x - 30, y - 34, 60, 68, 3)
    .fill({ color: WOOD })
    .stroke({ color: WOOD_DARK, width: 2 });
  for (let row = 0; row < rows; row++) {
    let bx = x - 26;
    const by = y - 28 + row * (60 / rows);
    let i = 0;
    while (bx < x + 20) {
      const w = 6 + (i % 3) * 2;
      g.rect(bx, by, w, 60 / rows - 4).fill({
        color: BOOK_COLORS[(i + row) % BOOK_COLORS.length],
      });
      bx += w + 1;
      i++;
    }
  }
  return g;
}

function buildServerRack(x: number, y: number): Graphics {
  const g = new Graphics()
    .roundRect(x - 16, y - 34, 32, 68, 2)
    .fill({ color: 0x24211c })
    .stroke({ color: WOOD_DARK, width: 2 });
  for (let i = 0; i < 4; i++) {
    g.rect(x - 10, y - 26 + i * 15, 20, 8).fill({ color: 0x1a1712 });
    g.circle(x + 6, y - 22 + i * 15, 1.5).fill({
      color: i % 2 === 0 ? SCREEN_GLOW : 0xd4a24c,
    });
  }
  return g;
}

function buildEasel(x: number, y: number, accent: number): Graphics {
  return new Graphics()
    .rect(x - 2, y - 30, 4, 50)
    .fill({ color: WOOD })
    .roundRect(x - 22, y - 34, 44, 32, 2)
    .fill({ color: CANVAS_CREAM })
    .stroke({ color: WOOD_DARK, width: 2 })
    .roundRect(x - 14, y - 26, 20, 16, 2)
    .fill({ color: accent });
}

function buildPlant(x: number, y: number): Graphics {
  return new Graphics()
    .roundRect(x - 12, y - 6, 24, 16, 3)
    .fill({ color: PLANT_POT })
    .stroke({ color: WOOD_DARK, width: 2 })
    .ellipse(x, y - 18, 14, 18)
    .fill({ color: PLANT_LEAF })
    .ellipse(x - 10, y - 10, 8, 12)
    .fill({ color: PLANT_LEAF })
    .ellipse(x + 10, y - 10, 8, 12)
    .fill({ color: PLANT_LEAF });
}

function buildInboxTray(x: number, y: number): Graphics {
  return new Graphics()
    .roundRect(x - 18, y - 10, 36, 20, 3)
    .fill({ color: 0x5a4830 })
    .stroke({ color: 0xd4a24c, width: 1.5 });
}

function buildRug(x: number, y: number, width: number, height: number) {
  return new Graphics()
    .roundRect(x - width / 2, y - height / 2, width, height, 6)
    .fill({ color: RUG })
    .stroke({ color: RUG_BORDER, width: 2 });
}

/** Alternating horizontal planks instead of one flat fill — cheap texture, same vector-graphics approach as everything else here. */
function buildFloor(): Graphics {
  const g = new Graphics().rect(0, 0, OFFICE_WIDTH, OFFICE_HEIGHT).fill({
    color: FLOOR,
  });
  const plankHeight = 40;
  for (let y = 0; y < OFFICE_HEIGHT; y += plankHeight) {
    if ((y / plankHeight) % 2 === 1) {
      g.rect(0, y, OFFICE_WIDTH, plankHeight).fill({ color: FLOOR_ALT });
    }
    g.rect(0, y, OFFICE_WIDTH, 1).fill({ color: FLOOR_BORDER, alpha: 0.4 });
  }
  g.rect(4, 4, OFFICE_WIDTH - 8, OFFICE_HEIGHT - 8).stroke({
    color: FLOOR_BORDER,
    width: 2,
  });
  return g;
}

function buildMeetingTable(): Graphics {
  return new Graphics()
    .roundRect(
      MEETING_TABLE_POSITION.x - 40,
      MEETING_TABLE_POSITION.y - 20,
      80,
      40,
      8,
    )
    .fill({ color: 0x3c3122 })
    .stroke({ color: WOOD_DARK, width: 2 });
}

/**
 * A room's 4 walls, split into two segments on whichever edge faces the
 * shared hallway to leave `DOOR_GAP` open at `ROOM_DOOR_POSITION[role]`.
 */
function buildRoomWalls(role: AgentRole): Graphics[] {
  const r = ROOM_RECT[role];
  const doorX = ROOM_DOOR_POSITION[role].x;
  const gapHalf = DOOR_GAP / 2;
  // Top-row rooms (manager, engineer) open onto the hallway along their
  // bottom edge; bottom-row rooms (designer, researcher) open along their top.
  const opensOnBottom = r.y < HALLWAY_TOP;

  const walls: Graphics[] = [
    vWall(r.y, r.y + r.height, r.x),
    vWall(r.y, r.y + r.height, r.x + r.width),
  ];

  if (opensOnBottom) {
    walls.push(hWall(r.x, r.x + r.width, r.y));
    walls.push(hWall(r.x, doorX - gapHalf, r.y + r.height));
    walls.push(hWall(doorX + gapHalf, r.x + r.width, r.y + r.height));
  } else {
    walls.push(hWall(r.x, doorX - gapHalf, r.y));
    walls.push(hWall(doorX + gapHalf, r.x + r.width, r.y));
    walls.push(hWall(r.x, r.x + r.width, r.y + r.height));
  }
  return walls;
}

/** Solid party walls between the two rooms sharing each row — no door, since travel between them always goes through the hallway. */
function buildCenterDividers(): Graphics[] {
  const gapStart = ROOM_RECT.manager.x + ROOM_RECT.manager.width;
  const gapEnd = ROOM_RECT.engineer.x;
  const cx = (gapStart + gapEnd) / 2;
  const thickness = gapEnd - gapStart;
  return [
    vWall(0, HALLWAY_TOP, cx, thickness),
    vWall(HALLWAY_BOTTOM, OFFICE_HEIGHT, cx, thickness),
  ];
}

/**
 * The full static office scene — floor, four walled rooms with doors, the
 * shared hallway, and a handful of original signature props per room.
 * Draws entirely from `office-layout.ts`'s fixed geometry rather than
 * runtime roster data: exactly one room per role always exists, since a
 * business always has all four role-templated agents.
 */
export function buildOfficeScene(): Container {
  const container = new Container();

  container.addChild(buildFloor());

  container.addChild(
    buildRug(MEETING_TABLE_POSITION.x, MEETING_TABLE_POSITION.y, 160, 90),
  );
  container.addChild(buildMeetingTable());
  container.addChild(buildPlant(OFFICE_WIDTH - 60, MEETING_TABLE_POSITION.y));

  for (const role of ROLES) {
    for (const wall of buildRoomWalls(role)) container.addChild(wall);
    const desk = ROLE_LAYOUT[role].deskPosition;
    container.addChild(buildDesk(desk.x, desk.y));
  }
  for (const wall of buildCenterDividers()) container.addChild(wall);

  container.addChild(
    buildInboxTray(MANAGER_INBOX_POSITION.x, MANAGER_INBOX_POSITION.y),
  );
  container.addChild(
    buildBookshelf(ROOM_RECT.manager.x + 320, ROOM_RECT.manager.y + 40),
  );

  const engineerDesk = ROLE_LAYOUT.engineer.deskPosition;
  container.addChild(buildMonitor(engineerDesk.x, engineerDesk.y));
  container.addChild(
    buildServerRack(ROOM_RECT.engineer.x + 330, ROOM_RECT.engineer.y + 180),
  );

  container.addChild(
    buildBookshelf(
      ROOM_RECT.researcher.x + 330,
      ROOM_RECT.researcher.y + 70,
      3,
    ),
  );

  container.addChild(
    buildEasel(
      ROOM_RECT.designer.x + 310,
      ROOM_RECT.designer.y + 170,
      ROLE_LAYOUT.designer.accentColor,
    ),
  );
  container.addChild(
    buildPlant(ROOM_RECT.designer.x + 330, ROOM_RECT.designer.y + 90),
  );

  return container;
}
