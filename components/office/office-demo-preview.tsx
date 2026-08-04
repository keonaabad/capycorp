"use client";

import { useEffect, useRef, useState } from "react";
import { createLocalOfficeAdapter } from "@/lib/simulation/adapter";
import { DEMO_SCRIPT } from "@/lib/simulation/demo-script";
import {
  playScript,
  type ScriptPlayerHandle,
} from "@/lib/simulation/script-player";
import { OFFICE_HEIGHT, OFFICE_WIDTH } from "@/lib/simulation/office-layout";
import { OfficeCanvas } from "./office-canvas";
import { AgentInspector } from "./agent-inspector";

/**
 * The landing page's public "watch it work" preview — auto-plays
 * DEMO_SCRIPT on a loop rather than requiring a click, since a marketing
 * page benefits from showing motion immediately. Deliberately narrower
 * than `/demo`'s OfficeExperience: canvas + AgentInspector only, no
 * DevControlPanel — manual state-override controls have no business
 * being exposed to an anonymous visitor, same reasoning that already
 * kept them off the real business page.
 */
export function OfficeDemoPreview() {
  const [adapter] = useState(() => createLocalOfficeAdapter());
  const playerRef = useRef<ScriptPlayerHandle | null>(null);

  useEffect(() => {
    playerRef.current = playScript(adapter, DEMO_SCRIPT, {
      loop: true,
      loopDelayMs: 3000,
    });
    return () => playerRef.current?.stop();
  }, [adapter]);

  return (
    <div className="grid gap-6 lg:grid-cols-[800px_1fr]">
      {/* OfficeCanvas's root is h-full/w-full with no aspect-ratio of its
          own (components/office/office-canvas.tsx) — correct for the real
          business page, where an ancestor flex chain gives it a real
          height to fill. This grid never sets an explicit row height
          (sized by content instead), and OfficeCanvas's own content is
          entirely position:absolute so it contributes nothing to that
          content height — h-full then resolves against nothing, and the
          canvas collapsed to ~0px tall. A fixed height would fix lg+ (the
          800px column) but distort mobile, where this cell's width isn't
          fixed — aspect-ratio keeps it proportional at every width, same
          as the pre-fill-fix behavior this call site relied on. */}
      <div
        className="w-full"
        style={{ aspectRatio: `${OFFICE_WIDTH} / ${OFFICE_HEIGHT}` }}
      >
        <OfficeCanvas adapter={adapter} />
      </div>
      <AgentInspector adapter={adapter} readOnly />
    </div>
  );
}
