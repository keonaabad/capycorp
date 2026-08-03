export interface TaskResultItem {
  id: string;
  title: string;
  result: string | null;
  status: string;
  completedAt: Date | null;
  agent: { name: string; role: string } | null;
}

/**
 * What each agent actually produced — Subtask.result, the one place the
 * agent's real answer text lives. Nothing else in the UI shows this:
 * AgentInspector only ever surfaces the single most recent result per
 * agent (via the currentTask scratch field), overwritten on every run.
 * Presentational only, mirroring ArtifactList/ActivityFeed — the page
 * fetches, this renders.
 */
export function TaskResults({
  results,
}: {
  results: readonly TaskResultItem[];
}) {
  if (results.length === 0) {
    return (
      <p
        className="rounded-lg border border-dashed border-border p-4 text-sm text-muted"
        data-testid="no-task-results"
      >
        No results yet — submit a goal to see what the team comes back with.
      </p>
    );
  }

  return (
    <div
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
      data-testid="task-results"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Results
      </h2>
      <ul className="space-y-3">
        {results.map((item) => (
          <li
            key={item.id}
            className="border-b border-border pb-3 text-sm last:border-b-0 last:pb-0"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-ink">{item.title}</p>
              {item.agent ? (
                <span className="shrink-0 text-xs text-muted">
                  {item.agent.name}
                </span>
              ) : null}
            </div>
            {item.result ? (
              <p
                className={`mt-1 whitespace-pre-wrap text-xs ${
                  item.status === "failed" ? "text-danger" : "text-ink/80"
                }`}
              >
                {item.result}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted">In progress…</p>
            )}
            {item.completedAt ? (
              <p className="mt-1 text-[11px] text-muted">
                {item.completedAt.toLocaleTimeString()}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
