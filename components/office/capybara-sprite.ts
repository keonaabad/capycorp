import type { AgentRole } from "@/lib/simulation/office-layout";

/**
 * Original pixel-art capybara sprites, drawn procedurally onto a tiny
 * canvas (no external image assets — see the proposal's originality rule).
 * Every role shares the same head/fur so they read as one species; only
 * the outfit differs, matching the proposal's "small capybaras with
 * role-specific outfits" character sheet.
 */
export const SPRITE_GRID_WIDTH = 20;
export const SPRITE_GRID_HEIGHT = 22;

const FUR_LIGHT = "#c9a06b";
const FUR_MID = "#a67c4a";
const FUR_SHADOW = "#7c5a34";
const SNOUT = "#e2c79a";
const INK = "#2a1d14";
const SHIRT = "#f1e9d8";
const MANAGER_TIE = "#c89a3c";
const HEADPHONE = "#33322e";

function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  corner: number,
) {
  rect(ctx, x, y, w, h, color);
  if (corner > 0) {
    ctx.clearRect(x, y, corner, corner);
    ctx.clearRect(x + w - corner, y, corner, corner);
    ctx.clearRect(x, y + h - corner, corner, corner);
    ctx.clearRect(x + w - corner, y + h - corner, corner, corner);
  }
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

/** Lighten (amount > 0) or darken (amount < 0) a role's accent color. */
function tint(hex: number, amount: number): string {
  const mix = (c: number) =>
    amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
  const [r, g, b] = hexToRgb(hex).map((c) =>
    Math.round(Math.min(255, Math.max(0, mix(c)))),
  );
  return `rgb(${r}, ${g}, ${b})`;
}

function drawHeadAndFace(ctx: CanvasRenderingContext2D) {
  roundedRect(ctx, 2, 1, 5, 4, FUR_MID, 1);
  roundedRect(ctx, 13, 1, 5, 4, FUR_MID, 1);
  rect(ctx, 3, 2, 2, 2, FUR_LIGHT);
  rect(ctx, 15, 2, 2, 2, FUR_LIGHT);

  roundedRect(ctx, 3, 3, 14, 9, FUR_MID, 2);
  rect(ctx, 4, 4, 12, 2, FUR_LIGHT);
  rect(ctx, 4, 9, 12, 3, FUR_SHADOW);
  roundedRect(ctx, 7, 8, 6, 3, SNOUT, 1);
  rect(ctx, 9, 9, 2, 1, INK);
}

function drawEyes(ctx: CanvasRenderingContext2D, glasses: boolean) {
  if (glasses) {
    rect(ctx, 6, 6, 3, 3, INK);
    rect(ctx, 12, 6, 3, 3, INK);
    rect(ctx, 7, 7, 1, 1, SNOUT);
    rect(ctx, 13, 7, 1, 1, SNOUT);
    rect(ctx, 9, 7, 2, 1, INK);
  } else {
    rect(ctx, 7, 7, 1, 1, INK);
    rect(ctx, 12, 7, 1, 1, INK);
  }
}

function drawManagerOutfit(ctx: CanvasRenderingContext2D, accent: number) {
  const light = tint(accent, 0.35);
  const mid = tint(accent, 0);
  const dark = tint(accent, -0.35);

  rect(ctx, 3, 12, 14, 1, SHIRT);
  roundedRect(ctx, 1, 13, 18, 8, mid, 2);
  rect(ctx, 2, 13, 16, 2, light);
  rect(ctx, 2, 18, 16, 3, dark);
  rect(ctx, 8, 13, 4, 2, MANAGER_TIE);
  rect(ctx, 9, 15, 2, 6, MANAGER_TIE);
}

function drawEngineerOutfit(ctx: CanvasRenderingContext2D, accent: number) {
  const light = tint(accent, 0.35);
  const mid = tint(accent, 0);
  const dark = tint(accent, -0.35);

  roundedRect(ctx, 1, 11, 5, 3, mid, 1);
  roundedRect(ctx, 14, 11, 5, 3, mid, 1);
  roundedRect(ctx, 1, 13, 18, 8, mid, 2);
  rect(ctx, 2, 13, 16, 2, light);
  rect(ctx, 2, 18, 16, 3, dark);
  rect(ctx, 9, 13, 1, 4, SHIRT);
  rect(ctx, 10, 13, 1, 4, SHIRT);
  roundedRect(ctx, 0, 5, 2, 3, HEADPHONE, 0);
  roundedRect(ctx, 18, 5, 2, 3, HEADPHONE, 0);
}

function drawResearcherOutfit(ctx: CanvasRenderingContext2D, accent: number) {
  const light = tint(accent, 0.35);
  const mid = tint(accent, 0);
  const dark = tint(accent, -0.35);

  rect(ctx, 3, 12, 14, 1, SHIRT);
  roundedRect(ctx, 1, 13, 18, 8, mid, 2);
  rect(ctx, 2, 13, 16, 2, light);
  rect(ctx, 2, 18, 16, 3, dark);
}

function drawDesignerOutfit(ctx: CanvasRenderingContext2D, accent: number) {
  const light = tint(accent, 0.35);
  const mid = tint(accent, 0);
  const dark = tint(accent, -0.35);

  roundedRect(ctx, 1, 13, 18, 8, mid, 2);
  rect(ctx, 2, 13, 16, 2, light);
  rect(ctx, 2, 18, 16, 3, dark);
  rect(ctx, 5, 11, 10, 3, mid);
}

const OUTFITS: Record<
  AgentRole,
  {
    glasses: boolean;
    draw: (ctx: CanvasRenderingContext2D, accent: number) => void;
  }
> = {
  manager: { glasses: false, draw: drawManagerOutfit },
  engineer: { glasses: false, draw: drawEngineerOutfit },
  researcher: { glasses: true, draw: drawResearcherOutfit },
  designer: { glasses: false, draw: drawDesignerOutfit },
};

/**
 * A 2-frame walk cycle drawn into the grid's unused bottom row (every
 * role's torso stops at row 20 of 22) — the feet swap position between
 * frames rather than a full sprite-sheet, which is enough to read as
 * walking at this size. `0` is the standing/idle frame.
 */
function drawFeet(ctx: CanvasRenderingContext2D, frame: 0 | 1) {
  if (frame === 0) {
    rect(ctx, 7, 21, 2, 1, FUR_SHADOW);
    rect(ctx, 11, 21, 2, 1, FUR_SHADOW);
  } else {
    rect(ctx, 6, 20, 2, 1, FUR_SHADOW);
    rect(ctx, 12, 21, 2, 1, FUR_SHADOW);
  }
}

/**
 * Draws one role's capybara onto a `SPRITE_GRID_WIDTH x SPRITE_GRID_HEIGHT`
 * canvas at 1 canvas-pixel = 1 sprite-pixel. The caller upscales with
 * nearest-neighbor sampling (`Texture`'s scale mode set to "nearest") so
 * the result stays crisp instead of blurring into the flat placeholder
 * shapes it replaces. `frame` selects the walk-cycle pose (see `drawFeet`).
 */
export function drawCapybaraSprite(
  ctx: CanvasRenderingContext2D,
  role: AgentRole,
  accentColor: number,
  frame: 0 | 1 = 0,
) {
  ctx.clearRect(0, 0, SPRITE_GRID_WIDTH, SPRITE_GRID_HEIGHT);
  const outfit = OUTFITS[role];
  drawHeadAndFace(ctx);
  drawEyes(ctx, outfit.glasses);
  outfit.draw(ctx, accentColor);
  drawFeet(ctx, frame);
}
