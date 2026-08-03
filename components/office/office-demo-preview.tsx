"use client";

import { useEffect, useRef, useState } from "react";
import { createLocalOfficeAdapter } from "@/lib/simulation/adapter";
import { DEMO_SCRIPT } from "@/lib/simulation/demo-script";
import {
  playScript,
  type ScriptPlayerHandle,
} from "@/lib/simulation/script-player";
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
      <OfficeCanvas adapter={adapter} />
      <AgentInspector adapter={adapter} />
    </div>
  );
}
