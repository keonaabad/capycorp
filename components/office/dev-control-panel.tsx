"use client";

import {
  AGENT_STATES,
  canTransition,
  isTerminal,
} from "@/lib/simulation/state-machine";
import {
  useOfficeSnapshot,
  type OfficeEventAdapter,
} from "@/lib/simulation/adapter";

export function DevControlPanel({
  adapter,
  disabled = false,
}: {
  adapter: OfficeEventAdapter;
  disabled?: boolean;
}) {
  const agents = useOfficeSnapshot(adapter, (snapshot) => snapshot.agents);
  const pendingAgentIds = useOfficeSnapshot(
    adapter,
    (snapshot) => snapshot.pendingAgentIds,
  );
  const lastError = useOfficeSnapshot(
    adapter,
    (snapshot) => snapshot.lastError,
  );

  return (
    <div
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
      data-testid="dev-control-panel"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Dev control panel
      </h2>
      <p className="text-xs text-muted">
        Manually drives each agent&apos;s state machine. This stands in for real
        backend events until orchestration is wired up.
      </p>
      {adapter.agentOrder.map((agentId) => {
        const runtime = agents[agentId];
        if (!runtime) return null;
        const isPending = pendingAgentIds.has(agentId);
        const controlsDisabled = disabled || isPending;
        const nextStates =
          runtime.current === "paused"
            ? []
            : AGENT_STATES.filter((state) =>
                canTransition(runtime.current, state),
              );

        return (
          <div
            key={agentId}
            className="rounded-lg border border-border p-3"
            data-testid={`agent-controls-${agentId}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-ink">
                {runtime.name}{" "}
                <span className="text-muted">· {runtime.role}</span>
              </span>
              <span
                className="font-mono text-xs text-accent"
                data-testid={`agent-state-${agentId}`}
              >
                {runtime.current}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {nextStates.map((state) => (
                <button
                  key={state}
                  type="button"
                  className="rounded border border-border px-2 py-1 text-[11px] text-ink/80 transition-colors hover:border-accent hover:text-accent disabled:opacity-30 disabled:hover:border-border disabled:hover:text-ink/80"
                  onClick={() => adapter.setAgentState(agentId, state)}
                  disabled={controlsDisabled}
                >
                  {state}
                </button>
              ))}
              {runtime.current === "paused" ? (
                <button
                  type="button"
                  className="rounded border border-accent/60 px-2 py-1 text-[11px] text-accent disabled:opacity-30"
                  onClick={() => adapter.resumeAgent(agentId)}
                  disabled={controlsDisabled}
                >
                  resume
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
                  onClick={() => adapter.pauseAgent(agentId)}
                  disabled={
                    controlsDisabled ||
                    runtime.current === "idle" ||
                    isTerminal(runtime.current)
                  }
                >
                  pause
                </button>
              )}
            </div>
            {lastError?.agentId === agentId ? (
              <p
                className="mt-2 text-[11px] text-danger"
                data-testid={`agent-error-${agentId}`}
              >
                {lastError.message}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
