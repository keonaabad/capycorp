"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createBackendOfficeAdapter,
  type BackendAgentSeed,
  type BackendOfficeAdapter,
} from "@/lib/simulation/adapter";
import { TaskComposer } from "@/components/business/task-composer";
import { AgentInspector } from "./agent-inspector";
import { OfficeCanvas } from "./office-canvas";
import {
  ActivityFeed,
  type ActivityFeedEvent,
} from "@/components/business/activity-feed";
import {
  ArtifactList,
  type ArtifactListItem,
} from "@/components/business/artifact-list";
import {
  TaskResults,
  type TaskResultItem,
} from "@/components/business/task-results";

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_MS = 90_000;

interface TaskPollResponse {
  task: { status: string; error: string | null };
  agents: {
    id: string;
    state: BackendAgentSeed["state"];
    resumeState: BackendAgentSeed["resumeState"];
    currentTask: string | null;
  }[];
  subtasks: {
    id: string;
    title: string;
    result: string | null;
    status: string;
    completedAt: string | null;
    agent: { name: string; role: string } | null;
  }[];
}

/**
 * The business "conversation" — office canvas dominant, the task
 * composer pinned like a chat input under it, and everything else
 * (agent inspector, deliverables, activity) in a right rail. Composes
 * OfficeCanvas/AgentInspector directly rather than going through
 * OfficeWorkspace's canvas+column grid — that grid still fits /demo's
 * simpler needs (no composer, no artifacts/activity), but this page's
 * layout is different enough it isn't worth forcing into the same shape.
 */
export function BusinessOffice({
  businessId,
  businessName,
  agents,
  events,
  artifacts,
  taskResults: initialTaskResults,
}: {
  businessId: string;
  businessName: string;
  agents: readonly BackendAgentSeed[];
  events: readonly ActivityFeedEvent[];
  artifacts: readonly ArtifactListItem[];
  taskResults: readonly TaskResultItem[];
}) {
  const router = useRouter();
  const [adapter] = useState<BackendOfficeAdapter>(() =>
    createBackendOfficeAdapter(businessId, agents),
  );
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [taskResults, setTaskResults] =
    useState<readonly TaskResultItem[]>(initialTaskResults);

  useEffect(() => {
    if (!activeTaskId) return;

    let cancelled = false;
    const startedAt = Date.now();

    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const response = await fetch(
          `/api/businesses/${businessId}/tasks/${activeTaskId}`,
        );
        if (cancelled || !response.ok) return; // transient — retried next tick

        const body = (await response.json()) as TaskPollResponse;
        if (cancelled) return;

        adapter.syncAgentsFromServer(body.agents);

        // Upsert rather than replace — this poll only covers the active
        // task's subtasks, and earlier tasks' results (seeded from the
        // page's initial fetch) shouldn't disappear while this one runs.
        // The eventual router.refresh() below remounts with a fresh
        // server fetch anyway, so this is just for live smoothness.
        setTaskResults((prev) => {
          const byId = new Map(prev.map((item) => [item.id, item]));
          for (const subtask of body.subtasks) {
            byId.set(subtask.id, {
              ...subtask,
              completedAt: subtask.completedAt
                ? new Date(subtask.completedAt)
                : null,
            });
          }
          return Array.from(byId.values());
        });

        if (body.task.status !== "running") {
          clearInterval(interval);
          setActiveTaskId(null);
          if (body.task.status === "failed" && body.task.error) {
            setPollError(body.task.error);
          }
          // Pulls fresh server data — this is what makes the page's
          // remount-via-key safe now that sprites seed their start
          // position from the agent's real current state, not idle.
          router.refresh();
          return;
        }

        if (Date.now() - startedAt > MAX_POLL_MS) {
          clearInterval(interval);
          setActiveTaskId(null);
          setPollError(
            "This task is taking longer than expected — it may still be running in the background. Check back shortly.",
          );
        }
      } catch {
        // Transient network error — retried next tick.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeTaskId, adapter, businessId, router]);

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border px-6 py-3">
          <h1 className="text-sm font-semibold text-ink">{businessName}</h1>
        </header>
        <div
          // The right rail (360px) is wider than the left sidebar (256px,
          // components/chrome/sidebar.tsx), so naive centering within this
          // column sits 52px left of true screen-center — (360-256)/2.
          // Margin-left on a flex-grow item only moves its visual center by
          // *half* the margin (the item's own width shrinks to absorb the
          // rest, pulling the center back by the other half) — verified by
          // measuring getBoundingClientRect() before landing on 104px here.
          // Only compensate at lg+, where the aside is actually visible;
          // below that it's hidden and centering here is already correct.
          className="flex flex-1 items-center justify-center overflow-y-auto p-6 lg:ml-[104px]"
        >
          <OfficeCanvas adapter={adapter} />
        </div>
        <div className="border-t border-border p-4">
          <TaskComposer
            businessId={businessId}
            disabled={activeTaskId !== null}
            onTaskStarted={(taskId) => {
              setPollError(null);
              setActiveTaskId(taskId);
            }}
          />
          {pollError ? (
            <p className="mt-2 text-xs text-danger">{pollError}</p>
          ) : null}
        </div>
      </div>

      <aside className="hidden w-[360px] shrink-0 space-y-6 overflow-y-auto border-l border-border bg-sidebar p-4 lg:block">
        <AgentInspector adapter={adapter} />
        <TaskResults results={taskResults} />
        <ArtifactList artifacts={artifacts} />
        <ActivityFeed events={events} />
      </aside>
    </div>
  );
}
