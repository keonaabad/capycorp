"use client";

import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Rectangle, Text } from "pixi.js";
import type { AgentState } from "@/lib/simulation/state-machine";
import {
  AGENTS,
  MANAGER_INBOX_POSITION,
  MEETING_TABLE_POSITION,
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
  destinationForState,
  getAgentDefinition,
  type AgentDefinition,
} from "@/lib/simulation/office-layout";
import type { OfficeEventAdapter } from "@/lib/simulation/adapter";

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
  body: Graphics;
  label: Text;
  badge: Text;
  ring: Graphics;
  target: { x: number; y: number };
  flashUntil: number;
  flashColor: number;
  lastState: AgentState | null;
}

function buildDesk(x: number, y: number): Graphics {
  return new Graphics()
    .roundRect(x - 26, y - 16, 52, 32, 4)
    .fill({ color: 0x3a2f27 })
    .stroke({ color: 0x241c17, width: 2 });
}

function buildCapybara(agent: AgentDefinition): SpriteRig {
  const container = new Container();
  container.x = agent.idlePosition.x;
  container.y = agent.idlePosition.y;
  container.eventMode = "static";
  container.cursor = "pointer";
  container.hitArea = new Rectangle(-22, -34, 44, 62);

  const ring = new Graphics().ellipse(0, 10, 22, 10).stroke({
    color: 0xf1d97a,
    width: 3,
  });
  ring.visible = false;

  const body = new Graphics()
    .roundRect(-16, -10, 32, 24, 10)
    .fill({ color: 0x9c7a4f })
    .roundRect(-11, -24, 22, 18, 8)
    .fill({ color: 0xb08e5f })
    .circle(-8, -22, 4)
    .fill({ color: 0xb08e5f })
    .circle(8, -22, 4)
    .fill({ color: 0xb08e5f })
    .circle(-4, -16, 1.6)
    .fill({ color: 0x241c17 })
    .circle(4, -16, 1.6)
    .fill({ color: 0x241c17 })
    .roundRect(-14, -10, 8, 8, 3)
    .fill({ color: agent.accentColor });

  const label = new Text({
    text: agent.name,
    style: {
      fill: 0xf4ead9,
      fontSize: 11,
      fontFamily: "ui-monospace, monospace",
    },
  });
  label.anchor.set(0.5, 0);
  label.y = 16;

  const badge = new Text({
    text: STATE_LABEL.idle,
    style: {
      fill: 0xb8f171,
      fontSize: 9,
      fontFamily: "ui-monospace, monospace",
      align: "center",
    },
  });
  badge.anchor.set(0.5, 1);
  badge.y = -30;

  container.addChild(ring, body, label, badge);

  return {
    container,
    body,
    label,
    badge,
    ring,
    target: { x: agent.idlePosition.x, y: agent.idlePosition.y },
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

    async function setup() {
      await app.init({
        width: OFFICE_WIDTH,
        height: OFFICE_HEIGHT,
        backgroundColor: 0x14100c,
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
      host.appendChild(app.canvas);

      const floor = new Graphics()
        .rect(0, 0, OFFICE_WIDTH, OFFICE_HEIGHT)
        .fill({ color: 0x1c1712 })
        .rect(8, 8, OFFICE_WIDTH - 16, OFFICE_HEIGHT - 16)
        .stroke({ color: 0x2a221a, width: 2 });
      app.stage.addChild(floor);

      for (const agent of AGENTS) {
        app.stage.addChild(
          buildDesk(agent.deskPosition.x, agent.deskPosition.y),
        );
      }
      const meetingTable = new Graphics()
        .roundRect(
          MEETING_TABLE_POSITION.x - 40,
          MEETING_TABLE_POSITION.y - 20,
          80,
          40,
          8,
        )
        .fill({ color: 0x2f271e })
        .stroke({ color: 0x241c17, width: 2 });
      app.stage.addChild(meetingTable);

      const inbox = new Graphics()
        .roundRect(
          MANAGER_INBOX_POSITION.x - 18,
          MANAGER_INBOX_POSITION.y + 24,
          36,
          20,
          3,
        )
        .fill({ color: 0x4a3a28 })
        .stroke({ color: 0xb8f171, width: 1.5 });
      app.stage.addChild(inbox);

      for (const agent of AGENTS) {
        const rig = buildCapybara(agent);
        rig.container.on("pointertap", () => adapter.selectAgent(agent.id));
        app.stage.addChild(rig.container);
        rigs.set(agent.id, rig);
      }

      applySnapshot();

      app.ticker.add(() => {
        const now = performance.now();
        for (const rig of rigs.values()) {
          const dx = rig.target.x - rig.container.x;
          const dy = rig.target.y - rig.container.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.5) {
            const step = Math.min(1, MOVE_SPEED / dist);
            rig.container.x += dx * step;
            rig.container.y += dy * step;
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
        const definition = getAgentDefinition(agentId);
        const state = agentSnapshot.current;

        if (state !== "paused") {
          const destination = destinationForState(definition, state);
          rig.target.x = destination.x;
          rig.target.y = destination.y;
        }

        rig.badge.text = state === "paused" ? "paused" : STATE_LABEL[state];
        rig.ring.visible = snapshot.selectedAgentId === agentId;
        rig.body.alpha = state === "paused" ? 0.55 : 1;

        if (rig.lastState !== state) {
          if (state === "completed" || state === "failed") {
            rig.flashUntil = performance.now() + 500;
          }
          rig.lastState = state;
        }
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
      ref={hostRef}
      className="overflow-hidden rounded-lg border border-white/10"
      style={{ width: OFFICE_WIDTH, height: OFFICE_HEIGHT }}
    />
  );
}
