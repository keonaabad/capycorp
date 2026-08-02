"use client";

import { useEffect, useRef, useState } from "react";
import { createLocalOfficeAdapter } from "@/lib/simulation/adapter";
import { DEMO_SCRIPT } from "@/lib/simulation/demo-script";
import {
  playScript,
  type ScriptPlayerHandle,
} from "@/lib/simulation/script-player";
import { OfficeCanvas } from "./office-canvas";
import { DevControlPanel } from "./dev-control-panel";
import { AgentInspector } from "./agent-inspector";

export function OfficeExperience() {
  const [adapter] = useState(() => createLocalOfficeAdapter());
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const playerRef = useRef<ScriptPlayerHandle | null>(null);

  useEffect(() => {
    return () => playerRef.current?.stop();
  }, []);

  function startDemo() {
    playerRef.current?.stop();
    playerRef.current = playScript(adapter, DEMO_SCRIPT, {
      loop: true,
      loopDelayMs: 3000,
    });
    setIsPlayingDemo(true);
  }

  function stopDemo() {
    playerRef.current?.stop();
    playerRef.current = null;
    setIsPlayingDemo(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-white/10 p-3">
        <button
          type="button"
          onClick={isPlayingDemo ? stopDemo : startDemo}
          className="rounded border border-lime-300/60 px-3 py-1.5 text-xs font-medium text-lime-300 transition-colors hover:bg-lime-300/10"
          data-testid="demo-toggle"
        >
          {isPlayingDemo ? "■ Stop scripted demo" : "▶ Play scripted demo"}
        </button>
        <p className="text-xs text-white/40">
          {isPlayingDemo
            ? "Playing a scripted task through the same OfficeEventAdapter the dev panel uses — manual controls are paused so the two don't fight over the same agents."
            : "Runs a canned research → design/engineering → approval task end to end, looping automatically."}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[720px_1fr]">
        <OfficeCanvas adapter={adapter} />
        <div className="space-y-6">
          <AgentInspector adapter={adapter} />
          <DevControlPanel adapter={adapter} disabled={isPlayingDemo} />
        </div>
      </div>
    </div>
  );
}
