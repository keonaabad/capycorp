"use client";

import {
  useOfficeSnapshot,
  type OfficeEventAdapter,
} from "@/lib/simulation/adapter";

export function AgentInspector({
  adapter,
  readOnly = false,
}: {
  adapter: OfficeEventAdapter;
  /** Hides the dev-only task-override input — for anonymous-facing
   * contexts (the landing page's demo preview) where, per that
   * component's own intent, manual state control has no business being
   * exposed. The real business page keeps it (default false). */
  readOnly?: boolean;
}) {
  const selectedAgentId = useOfficeSnapshot(
    adapter,
    (snapshot) => snapshot.selectedAgentId,
  );
  const agents = useOfficeSnapshot(adapter, (snapshot) => snapshot.agents);

  if (!selectedAgentId) {
    return (
      <div
        className="rounded-lg border border-dashed border-border p-4 text-xs text-muted"
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
      className="rounded-lg border border-border bg-surface p-4"
      data-testid="agent-inspector"
      data-agent-id={selectedAgentId}
    >
      <p className="font-mono text-xs uppercase tracking-wide text-muted">
        {runtime?.role}
      </p>
      <h3 className="mt-1 text-lg font-semibold text-ink">{runtime?.name}</h3>
      <p
        className="mt-2 font-mono text-xs text-accent"
        data-testid="inspector-state"
      >
        state: {runtime?.current}
      </p>
      <p className="mt-2 text-sm break-words text-ink/70">
        {runtime?.task ?? "No task assigned yet."}
      </p>
      {readOnly ? null : (
        <label className="mt-3 block text-[11px] uppercase tracking-wide text-muted">
          Set task (dev only)
          <input
            className="mt-1 w-full rounded border border-border bg-transparent px-2 py-1 text-sm text-ink outline-none focus:border-accent"
            value={runtime?.task ?? ""}
            onChange={(event) =>
              adapter.setAgentTask(selectedAgentId, event.target.value || null)
            }
            placeholder="e.g. Compare competitor pricing"
          />
        </label>
      )}
    </div>
  );
}
