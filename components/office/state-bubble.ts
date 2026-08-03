import { Graphics } from "pixi.js";
import type { AgentState } from "@/lib/simulation/state-machine";

/**
 * "Read the state without reading the badge" — a small icon bubble above
 * each sprite's head for the states where a glyph reads faster than text
 * (proposal §14's animation-state table: alert/thought bubbles, a
 * confused error bubble, etc). Deliberately not every state: walking,
 * working, waiting, and collaborating are already legible from position
 * and the walk animation alone, and `needs_approval` gets the carried
 * folder below instead of a bubble (see `buildFolderIcon`), per the
 * proposal's own distinct treatment of that one state.
 */
export type BubbleIcon =
  | "alert"
  | "thought"
  | "tool"
  | "check"
  | "cross"
  | "pause";

export const STATE_BUBBLE_ICON: Partial<Record<AgentState, BubbleIcon>> = {
  assigned: "alert",
  planning: "thought",
  using_tool: "tool",
  completed: "check",
  failed: "cross",
  paused: "pause",
};

const BUBBLE_BG = 0xf1e9d8;
const BUBBLE_BORDER = 0x2e2419;
const INK = 0x2a1d14;
const ACCENT = 0xd4a24c;
const SUCCESS = 0x4f7a4a;
const DANGER = 0xae3b2e;

export const BUBBLE_RADIUS = 9;

export function buildBubbleBackground(): Graphics {
  return new Graphics()
    .circle(0, 0, BUBBLE_RADIUS)
    .fill({ color: BUBBLE_BG })
    .stroke({ color: BUBBLE_BORDER, width: 1.5 });
}

/** Redraws the glyph layer for one icon — called once per state change, not per frame. */
export function drawBubbleGlyph(g: Graphics, icon: BubbleIcon): void {
  g.clear();
  switch (icon) {
    case "alert":
      g.rect(-1, -4, 2, 5).fill({ color: INK });
      g.circle(0, 4, 1.2).fill({ color: INK });
      break;
    case "thought":
      g.circle(-4, 0, 1.3).fill({ color: INK });
      g.circle(0, 0, 1.3).fill({ color: INK });
      g.circle(4, 0, 1.3).fill({ color: INK });
      break;
    case "tool":
      g.circle(-1, -1, 3)
        .fill({ color: ACCENT })
        .stroke({ color: INK, width: 1 });
      g.rect(1, 1, 5, 2)
        .fill({ color: ACCENT })
        .stroke({ color: INK, width: 1 });
      break;
    case "check":
      g.moveTo(-4, 0)
        .lineTo(-1, 3)
        .lineTo(4, -4)
        .stroke({ color: SUCCESS, width: 2 });
      break;
    case "cross":
      g.moveTo(-4, -4).lineTo(4, 4).stroke({ color: DANGER, width: 2 });
      g.moveTo(4, -4).lineTo(-4, 4).stroke({ color: DANGER, width: 2 });
      break;
    case "pause":
      g.rect(-3, -4, 2, 8).fill({ color: INK });
      g.rect(1, -4, 2, 8).fill({ color: INK });
      break;
  }
}

/**
 * A small manila folder, shown only during `needs_approval` — the
 * proposal's own distinct treatment for that state ("carry folder to
 * manager or user inbox") rather than a generic bubble icon.
 */
export function buildFolderIcon(): Graphics {
  return new Graphics()
    .roundRect(-7, -7, 8, 3, 1)
    .fill({ color: 0xc9a06b })
    .stroke({ color: 0x2a1d14, width: 1 })
    .roundRect(-7, -5, 14, 10, 1)
    .fill({ color: 0xc9a06b })
    .stroke({ color: 0x2a1d14, width: 1 });
}
