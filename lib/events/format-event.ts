import type { AgentEvent } from "@/lib/generated/prisma/client";

type EventInput = Pick<AgentEvent, "type" | "data">;

const FALLBACK_LABEL = "Activity recorded";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Turns a raw AgentEvent row into a human-readable label. `data`'s type
 * (Prisma.JsonValue | null) has zero structural link to `type` at the
 * type level, so a *recognized* type can still carry malformed/null data
 * — that's schema-legal, not just a hypothetical. Falls back to a plain
 * label rather than throwing either way, since one bad row shouldn't fail
 * the whole feed's render.
 */
export function formatEventLabel(event: EventInput): string {
  const data = event.data;

  switch (event.type) {
    case "agent.state_changed": {
      if (!isRecord(data)) return FALLBACK_LABEL;
      const { from, to } = data;
      if (typeof from !== "string" || typeof to !== "string") {
        return FALLBACK_LABEL;
      }
      return `${from} → ${to}`;
    }

    case "agent.tool_started": {
      if (!isRecord(data)) return FALLBACK_LABEL;
      const { tool, query } = data;
      if (typeof tool !== "string" || typeof query !== "string") {
        return FALLBACK_LABEL;
      }
      return `Started ${tool.replace(/_/g, " ")}: "${query}"`;
    }

    case "agent.tool_completed": {
      if (!isRecord(data)) return FALLBACK_LABEL;
      const { tool, ok, resultCount, error } = data;
      if (typeof tool !== "string" || typeof ok !== "boolean") {
        return FALLBACK_LABEL;
      }
      const label = tool.replace(/_/g, " ");
      if (ok) {
        const count = typeof resultCount === "number" ? resultCount : "some";
        return `Finished ${label} — found ${count} result${count === 1 ? "" : "s"}`;
      }
      return `${label} failed${typeof error === "string" ? `: ${error}` : ""}`;
    }

    default:
      return FALLBACK_LABEL;
  }
}
