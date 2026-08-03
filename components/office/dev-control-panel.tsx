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
    <div className="space-y-3" data-testid="dev-control-panel">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
        Dev control panel
      </h2>
      <p className="text-xs text-white/40">
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
            className="rounded-md border border-white/10 p-3"
            data-testid={`agent-controls-${agentId}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-white/70">
                {runtime.name}{" "}
                <span className="text-white/40">· {runtime.role}</span>
              </span>
              <span
                className="font-mono text-xs text-lime-300"
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
                  className="rounded border border-white/15 px-2 py-1 text-[11px] text-white/80 transition-colors hover:border-lime-300 hover:text-lime-300 disabled:opacity-30 disabled:hover:border-white/15 disabled:hover:text-white/80"
                  onClick={() => adapter.setAgentState(agentId, state)}
                  disabled={controlsDisabled}
                >
                  {state}
                </button>
              ))}
              {runtime.current === "paused" ? (
                <button
                  type="button"
                  className="rounded border border-lime-300/60 px-2 py-1 text-[11px] text-lime-300 disabled:opacity-30"
                  onClick={() => adapter.resumeAgent(agentId)}
                  disabled={controlsDisabled}
                >
                  resume
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded border border-white/15 px-2 py-1 text-[11px] text-white/60 transition-colors hover:border-amber-300 hover:text-amber-300 disabled:opacity-30"
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
                className="mt-2 text-[11px] text-red-400"
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
