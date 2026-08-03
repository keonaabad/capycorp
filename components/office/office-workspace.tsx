import type { OfficeEventAdapter } from "@/lib/simulation/adapter";
import { OfficeCanvas } from "./office-canvas";
import { DevControlPanel } from "./dev-control-panel";
import { AgentInspector } from "./agent-inspector";

/**
 * The canvas + inspector + dev-panel grid, isolated from anything that
 * decides *which* adapter feeds it — the local in-memory adapter (Phase 1,
 * the /demo page) and the Postgres-backed adapter (a real business) both
 * render through this same component unmodified.
 */
export function OfficeWorkspace({
  adapter,
  disabled = false,
}: {
  adapter: OfficeEventAdapter;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[800px_1fr]">
      <OfficeCanvas adapter={adapter} />
      <div className="space-y-6">
        <AgentInspector adapter={adapter} />
        <DevControlPanel adapter={adapter} disabled={disabled} />
      </div>
    </div>
  );
}
