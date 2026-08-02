"use client";

import { useState } from "react";
import { createLocalOfficeAdapter } from "@/lib/simulation/adapter";
import { OfficeCanvas } from "./office-canvas";
import { DevControlPanel } from "./dev-control-panel";
import { AgentInspector } from "./agent-inspector";

export function OfficeExperience() {
  const [adapter] = useState(() => createLocalOfficeAdapter());

  return (
    <div className="grid gap-6 lg:grid-cols-[720px_1fr]">
      <OfficeCanvas adapter={adapter} />
      <div className="space-y-6">
        <AgentInspector adapter={adapter} />
        <DevControlPanel adapter={adapter} />
      </div>
    </div>
  );
}
