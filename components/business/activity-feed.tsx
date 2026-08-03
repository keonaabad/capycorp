import { formatEventLabel } from "@/lib/events/format-event";
import type { AgentEvent } from "@/lib/generated/prisma/client";

export interface ActivityFeedEvent {
  id: string;
  type: string;
  data: AgentEvent["data"];
  createdAt: Date;
  agent: { name: string; role: string } | null;
}

/**
 * Reads back the AgentEvent history — written since Phase 3, never
 * displayed until now. Presentational only: the page fetches, this
 * renders. Picks up new events "for free" whenever the page's Server
 * Component tree reruns (a normal navigation, or the router.refresh()
 * BusinessOffice already fires when a live task run finishes) — no
 * polling, no client state of its own.
 */
export function ActivityFeed({
  events,
}: {
  events: readonly ActivityFeedEvent[];
}) {
  if (events.length === 0) {
    return (
      <p
        className="rounded-md border border-dashed border-white/15 p-4 text-sm text-white/50"
        data-testid="no-activity"
      >
        No activity yet — submit a goal or drive a transition to see it here.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="activity-feed">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
        Activity
      </h2>
      <ul className="space-y-2">
        {events.map((event) => {
          const label = formatEventLabel(event);
          return (
            <li
              key={event.id}
              className="flex items-baseline gap-2 border-b border-white/5 pb-2 text-sm"
            >
              <span className="shrink-0 font-mono text-[11px] text-white/30">
                {event.createdAt.toLocaleTimeString()}
              </span>
              {event.agent ? (
                <span className="shrink-0 font-mono text-xs text-white/60">
                  {event.agent.name}
                </span>
              ) : null}
              <span className="truncate text-white/80" title={label}>
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
