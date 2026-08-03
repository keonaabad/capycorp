"use client";

import {
  useOfficeSnapshot,
  type OfficeEventAdapter,
} from "@/lib/simulation/adapter";

export function AgentInspector({ adapter }: { adapter: OfficeEventAdapter }) {
  const selectedAgentId = useOfficeSnapshot(
    adapter,
    (snapshot) => snapshot.selectedAgentId,
  );
  const agents = useOfficeSnapshot(adapter, (snapshot) => snapshot.agents);

  if (!selectedAgentId) {
    return (
      <div
        className="rounded-md border border-dashed border-white/15 p-4 text-xs text-white/50"
        data-testid="agent-inspector"
      >
        Click a capybara in the office to inspect its role, state, and current
        task.
      </div>
    );
  }

  const runtime = agents[selectedAgentId];

  return (
    <div
      className="rounded-md border border-white/10 p-4"
      data-testid="agent-inspector"
    >
      <p className="font-mono text-xs uppercase tracking-wide text-white/50">
        {runtime?.role}
      </p>
      <h3 className="mt-1 text-lg font-semibold text-white">{runtime?.name}</h3>
      <p
        className="mt-2 font-mono text-xs text-lime-300"
        data-testid="inspector-state"
      >
        state: {runtime?.current}
      </p>
      <p className="mt-2 text-sm text-white/70">
        {runtime?.task ?? "No task assigned yet."}
      </p>
      <label className="mt-3 block text-[11px] uppercase tracking-wide text-white/40">
        Set task (dev only)
        <input
          className="mt-1 w-full rounded border border-white/15 bg-transparent px-2 py-1 text-sm text-white outline-none focus:border-lime-300"
          value={runtime?.task ?? ""}
          onChange={(event) =>
            adapter.setAgentTask(selectedAgentId, event.target.value || null)
          }
          placeholder="e.g. Compare competitor pricing"
        />
      </label>
    </div>
  );
}
