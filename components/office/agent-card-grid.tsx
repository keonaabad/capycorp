"use client";

import {
  useOfficeSnapshot,
  type OfficeEventAdapter,
} from "@/lib/simulation/adapter";
import { ROLE_LAYOUT } from "@/lib/simulation/office-layout";
import { STATE_LABEL } from "@/lib/simulation/state-machine";

/**
 * Always-visible summary of every agent — the "at a glance, all 4" view.
 * Clicking a card selects that agent, same as clicking its sprite in the
 * office; AgentInspector (rendered just below this) stays the "deep dive
 * on the selected one" view, including the dev-only task-override input
 * this grid deliberately doesn't duplicate.
 */
export function AgentCardGrid({ adapter }: { adapter: OfficeEventAdapter }) {
  const agents = useOfficeSnapshot(adapter, (snapshot) => snapshot.agents);
  const selectedAgentId = useOfficeSnapshot(
    adapter,
    (snapshot) => snapshot.selectedAgentId,
  );

  return (
    <div
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
      data-testid="agent-card-grid"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Team
      </h2>
      <ul className="grid grid-cols-2 gap-2">
        {adapter.agentOrder.map((id) => {
          const agent = agents[id];
          if (!agent) return null;
          const accentColor = ROLE_LAYOUT[agent.role].accentColor;
          const accentHex = `#${accentColor.toString(16).padStart(6, "0")}`;
          const selected = selectedAgentId === id;

          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => adapter.selectAgent(id)}
                data-testid="agent-card"
                data-agent-id={id}
                data-selected={selected}
                className={`w-full rounded border p-2 text-left transition-colors ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-accent/50"
                }`}
                style={{ borderLeft: `3px solid ${accentHex}` }}
              >
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted">
                  {agent.role}
                </p>
                <p className="text-sm font-semibold text-ink">{agent.name}</p>
                <p className="mt-1 font-mono text-[11px] text-accent">
                  {STATE_LABEL[agent.current]}
                </p>
                <p className="mt-1 truncate text-xs text-ink/70">
                  {agent.task ?? "No task assigned yet."}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
