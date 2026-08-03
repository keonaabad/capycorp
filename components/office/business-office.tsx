"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createBackendOfficeAdapter,
  type BackendAgentSeed,
  type BackendOfficeAdapter,
} from "@/lib/simulation/adapter";
import { TaskComposer } from "@/components/business/task-composer";
import { OfficeWorkspace } from "./office-workspace";

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
}

export function BusinessOffice({
  businessId,
  agents,
}: {
  businessId: string;
  agents: readonly BackendAgentSeed[];
}) {
  const router = useRouter();
  const [adapter] = useState<BackendOfficeAdapter>(() =>
    createBackendOfficeAdapter(businessId, agents),
  );
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

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

        if (body.task.status !== "running") {
          clearInterval(interval);
          setActiveTaskId(null);
          if (body.task.status === "failed" && body.task.error) {
            setPollError(body.task.error);
          }
          // Pulls fresh server data — this is what makes the office.tsx
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
    <div className="space-y-6">
      <TaskComposer
        businessId={businessId}
        disabled={activeTaskId !== null}
        onTaskStarted={(taskId) => {
          setPollError(null);
          setActiveTaskId(taskId);
        }}
      />
      {pollError ? <p className="text-xs text-red-400">{pollError}</p> : null}
      <OfficeWorkspace adapter={adapter} disabled={activeTaskId !== null} />
    </div>
  );
}
