"use client";

import { useEffect, useRef } from "react";
import {
  Application,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from "pixi.js";
import type { AgentState } from "@/lib/simulation/state-machine";
import {
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
  pathTo,
  zoneForState,
  type OfficePoint,
  type OfficeZone,
} from "@/lib/simulation/office-layout";
import type {
  AgentSnapshot,
  OfficeEventAdapter,
} from "@/lib/simulation/adapter";
import {
  drawCapybaraSprite,
  SPRITE_GRID_HEIGHT,
  SPRITE_GRID_WIDTH,
} from "./capybara-sprite";
import { buildOfficeScene } from "./office-decor";
import {
  STATE_BUBBLE_ICON,
  buildBubbleBackground,
  buildFolderIcon,
  drawBubbleGlyph,
} from "./state-bubble";

type CapybaraSpec = Pick<
  AgentSnapshot,
  | "id"
  | "name"
  | "role"
  | "accentColor"
  | "idlePosition"
  | "deskPosition"
  | "current"
>;

const SPRITE_SCALE = 2.2;
const WALK_FRAME_INTERVAL_MS = 180;

function buildCapybaraTexture(agent: CapybaraSpec, frame: 0 | 1): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_GRID_WIDTH;
  canvas.height = SPRITE_GRID_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    drawCapybaraSprite(ctx, agent.role, agent.accentColor, frame);
  }
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return texture;
}

const MOVE_SPEED = 2.4; // px per frame at 60fps
const STATE_LABEL: Record<AgentState, string> = {
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

interface SpriteRig {
  container: Container;
  body: Sprite;
  agent: CapybaraSpec;
  // The walk frame is built lazily, the first time an agent actually
  // walks — building it eagerly for all 4 sprites at mount (8 canvas
  // draws + GPU texture uploads instead of 4) was enough one-time
  // synchronous work to noticeably delay initial paint under load.
  textures: [Texture, Texture | null];
  walkFrame: 0 | 1;
  nextFrameSwapAt: number;
  facing: 1 | -1;
  label: Text;
  badge: Text;
  ring: Graphics;
  /** Above the badge — an at-a-glance icon for the states where a glyph reads faster than the badge text. */
  stateBubble: Container;
  stateBubbleGlyph: Graphics;
  /** Visible only during needs_approval — see state-bubble.ts's buildFolderIcon. */
  folderIcon: Graphics;
  /** Waypoint queue toward the current destination — see office-layout.ts's pathTo(). */
  path: OfficePoint[];
  /** The room (or hallway) the sprite is standing in once `path` empties. */
  zone: OfficeZone;
  /** The zone `path`'s final waypoint lives in — becomes `zone` on arrival. */
  targetZone: OfficeZone;
  flashUntil: number;
  flashColor: number;
  lastState: AgentState | null;
}

function buildCapybara(agent: CapybaraSpec): SpriteRig {
  const container = new Container();
  // Seed from wherever the agent's *current* state actually places it, not
  // always idlePosition — otherwise a remount mid- or post-run (e.g. the
  // router.refresh() after a live task finishes) snaps every sprite back
  // to idle and replays the walk, which reads as a glitch once there's a
  // live animation to interrupt. "paused" has no zone/destination of its
  // own (see zoneForState/destinationForState's contract), so it falls
  // back to idle.
  const initialState = agent.current === "paused" ? "idle" : agent.current;
  const zone = zoneForState(agent.role, initialState);
  const startPosition = pathTo(agent, zone, initialState).at(-1)!;
  container.x = startPosition.x;
  container.y = startPosition.y;
  container.eventMode = "static";
  container.cursor = "pointer";
  container.hitArea = new Rectangle(-24, -40, 48, 70);

  const ring = new Graphics().ellipse(0, 10, 22, 10).stroke({
    color: 0xd4a24c,
    width: 3,
  });
  ring.visible = false;

  // A flat contact shadow at the sprite's feet (y: 14, same anchor the
  // body itself lands on) — grounds each capybara against the floor
  // instead of it looking like it's floating over the pixel art.
  const shadow = new Graphics()
    .ellipse(0, 16, 17, 5)
    .fill({ color: 0x000000, alpha: 0.28 });

  // Anchored at its own bottom edge so the sprite's feet land on `y: 14`,
  // matching the desk/table/inbox y-coordinates in office-layout.ts exactly
  // the way the old Graphics body's bottom edge (roundRect ending at +14) did.
  const textures: [Texture, Texture | null] = [
    buildCapybaraTexture(agent, 0),
    null,
  ];
  const body = new Sprite(textures[0]);
  body.anchor.set(0.5, 1);
  body.scale.set(SPRITE_SCALE);
  body.y = 14;

  const label = new Text({
    text: agent.name,
    style: {
      fill: 0xf1e9d8,
      fontSize: 11,
      fontFamily: "ui-monospace, monospace",
    },
  });
  label.anchor.set(0.5, 0);
  label.y = 16;

  const badge = new Text({
    text: STATE_LABEL.idle,
    style: {
      fill: 0xd4a24c,
      fontSize: 9,
      fontFamily: "ui-monospace, monospace",
      align: "center",
    },
  });
  badge.anchor.set(0.5, 1);
  badge.y = -38;

  // Beside the head rather than stacked above the badge — idle positions
  // for the top-row rooms (manager/engineer) sit only 40px below the
  // room's own wall, not enough headroom to stack a bubble above the
  // badge without it clipping off the top of the canvas.
  const stateBubbleGlyph = new Graphics();
  const stateBubble = new Container();
  stateBubble.addChild(buildBubbleBackground(), stateBubbleGlyph);
  stateBubble.position.set(15, -28);
  stateBubble.visible = false;

  const folderIcon = buildFolderIcon();
  folderIcon.position.set(18, -2);
  folderIcon.visible = false;

  container.addChild(ring, shadow, body, label, badge, stateBubble, folderIcon);

  return {
    container,
    body,
    agent,
    textures,
    walkFrame: 0,
    nextFrameSwapAt: 0,
    facing: 1,
    label,
    badge,
    ring,
    stateBubble,
    stateBubbleGlyph,
    folderIcon,
    path: [],
    zone,
    targetZone: zone,
    flashUntil: 0,
    flashColor: 0xffffff,
    lastState: null,
  };
}

export function OfficeCanvas({ adapter }: { adapter: OfficeEventAdapter }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let appReady = false;
    const app = new Application();
    const rigs = new Map<string, SpriteRig>();
    // Computed once at setup time — safe because the adapter's roster is
    // seeded synchronously (both for the local adapter and the backend
    // adapter, which is constructed from server-fetched data).
    const roster = adapter.agentOrder
      .map((id) => adapter.getSnapshot().agents[id])
      .filter((agent): agent is AgentSnapshot => Boolean(agent));

    async function setup() {
      await app.init({
        width: OFFICE_WIDTH,
        height: OFFICE_HEIGHT,
        backgroundColor: 0x2b241c,
        antialias: true,
      });
      if (disposed || !host) {
        // Unmounted (e.g. Strict Mode's dev double-invoke) before init
        // resolved. app.canvas/app.destroy aren't safe to touch until
        // init finishes, which is why the outer cleanup below doesn't
        // call them in this case — this is the only teardown path.
        app.destroy(true, { children: true });
        return;
      }
      appReady = true;
      // PixiJS still renders at a fixed OFFICE_WIDTH x OFFICE_HEIGHT
      // resolution — cheap and plenty crisp for pixel art — but the
      // canvas element itself is told to fill its (now responsive) host
      // div instead of sitting at a fixed pixel size, so it scales down
      // on narrower viewports and up on wider ones instead of sitting at
      // a fixed 800px regardless of how much room is actually available.
      // image-rendering: pixelated keeps that upscaling crisp (nearest-
      // neighbor) instead of the browser's default blurry bilinear scale
      // — correct for pixel art either direction.
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";
      app.canvas.style.display = "block";
      app.canvas.style.imageRendering = "pixelated";
      host.appendChild(app.canvas);

      app.stage.addChild(buildOfficeScene());

      for (const agent of roster) {
        const rig = buildCapybara(agent);
        rig.container.on("pointertap", () => adapter.selectAgent(agent.id));
        app.stage.addChild(rig.container);
        rigs.set(agent.id, rig);
      }

      applySnapshot();

      app.ticker.add(() => {
        const now = performance.now();
        for (const rig of rigs.values()) {
          const waypoint = rig.path[0];
          const moving = waypoint !== undefined;

          if (waypoint) {
            const dx = waypoint.x - rig.container.x;
            const dy = waypoint.y - rig.container.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.5) {
              const step = Math.min(1, MOVE_SPEED / dist);
              rig.container.x += dx * step;
              rig.container.y += dy * step;
              // Only flip on a meaningful horizontal component — a purely
              // vertical leg of a path (e.g. walking straight down through
              // a door) shouldn't make the sprite flicker between facings.
              if (Math.abs(dx) > 1) {
                rig.facing = dx > 0 ? 1 : -1;
              }
            } else {
              rig.path.shift();
              if (rig.path.length === 0) {
                rig.zone = rig.targetZone;
              }
            }
          }

          rig.body.scale.x = rig.facing * SPRITE_SCALE;

          if (moving) {
            if (now >= rig.nextFrameSwapAt) {
              rig.walkFrame = rig.walkFrame === 0 ? 1 : 0;
              if (rig.walkFrame === 1 && !rig.textures[1]) {
                rig.textures[1] = buildCapybaraTexture(rig.agent, 1);
              }
              rig.body.texture = rig.textures[rig.walkFrame] ?? rig.textures[0];
              rig.nextFrameSwapAt = now + WALK_FRAME_INTERVAL_MS;
            }
          } else if (rig.walkFrame !== 0) {
            rig.walkFrame = 0;
            rig.body.texture = rig.textures[0];
            rig.nextFrameSwapAt = 0;
          }

          if (rig.flashUntil > now) {
            const t = 1 - (rig.flashUntil - now) / 500;
            rig.container.scale.set(1 + Math.sin(t * Math.PI) * 0.18);
          } else {
            rig.container.scale.set(1);
          }
        }
      });

      unsubscribe = adapter.subscribe(applySnapshot);
    }

    let unsubscribe = () => {};

    function applySnapshot() {
      const snapshot = adapter.getSnapshot();
      for (const [agentId, rig] of rigs) {
        const agentSnapshot = snapshot.agents[agentId];
        if (!agentSnapshot) continue;
        const state = agentSnapshot.current;

        if (rig.lastState !== state) {
          if (state !== "paused") {
            rig.targetZone = zoneForState(agentSnapshot.role, state);
            rig.path = pathTo(agentSnapshot, rig.zone, state);
          }
          if (state === "completed" || state === "failed") {
            rig.flashUntil = performance.now() + 500;
          }
          const icon = STATE_BUBBLE_ICON[state];
          if (icon) {
            drawBubbleGlyph(rig.stateBubbleGlyph, icon);
          }
          rig.stateBubble.visible = Boolean(icon);
          rig.folderIcon.visible = state === "needs_approval";
          rig.lastState = state;
        }

        rig.badge.text = state === "paused" ? "paused" : STATE_LABEL[state];
        rig.ring.visible = snapshot.selectedAgentId === agentId;
        const dimmed = state === "paused";
        rig.body.alpha = dimmed ? 0.55 : 1;
        rig.stateBubble.alpha = dimmed ? 0.55 : 1;
        rig.folderIcon.alpha = dimmed ? 0.55 : 1;
      }
    }

    setup();

    return () => {
      disposed = true;
      unsubscribe();
      if (appReady) {
        if (app.canvas?.parentElement) {
          app.canvas.parentElement.removeChild(app.canvas);
        }
        app.destroy(true, { children: true });
      }
    };
  }, [adapter]);

  return (
    <div
      className="relative w-full max-w-[1100px] overflow-hidden rounded-lg"
      style={{ aspectRatio: `${OFFICE_WIDTH} / ${OFFICE_HEIGHT}` }}
    >
      <div ref={hostRef} className="absolute inset-0" />
      {/* A sibling overlay, not a shadow/border on the host div itself —
          those would paint *behind* the canvas child and never show.
          pointer-events-none so it doesn't block clicking capybaras. */}
      <div className="pointer-events-none absolute inset-0 rounded-lg border border-border shadow-[inset_0_0_40px_rgba(0,0,0,0.35)]" />
    </div>
  );
}
