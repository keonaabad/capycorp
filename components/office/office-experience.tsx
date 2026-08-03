"use client";

import { useEffect, useRef, useState } from "react";
import { createLocalOfficeAdapter } from "@/lib/simulation/adapter";
import { DEMO_SCRIPT } from "@/lib/simulation/demo-script";
import {
  playScript,
  type ScriptPlayerHandle,
} from "@/lib/simulation/script-player";
import { OfficeWorkspace } from "./office-workspace";

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
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
        <button
          type="button"
          onClick={isPlayingDemo ? stopDemo : startDemo}
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-opacity hover:opacity-90"
          data-testid="demo-toggle"
        >
          {isPlayingDemo ? "■ Stop scripted demo" : "▶ Play scripted demo"}
        </button>
        <p className="text-xs text-muted">
          {isPlayingDemo
            ? "Playing a scripted task through the same OfficeEventAdapter the dev panel uses — manual controls are paused so the two don't fight over the same agents."
            : "Runs a canned research → design/engineering → approval task end to end, looping automatically."}
        </p>
      </div>
      <OfficeWorkspace adapter={adapter} disabled={isPlayingDemo} />
    </div>
  );
}
