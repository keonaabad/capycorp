"use client";

import { useState } from "react";

export function TaskComposer({
  businessId,
  disabled = false,
  onTaskStarted,
}: {
  businessId: string;
  /** True while a task run this composer started is still being polled by the parent. */
  disabled?: boolean;
  onTaskStarted: (taskId: string) => void;
}) {
  const [goal, setGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!goal.trim()) {
      setError("A goal is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/businesses/${businessId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim() }),
      });
      const body = (await response.json().catch(() => null)) as
        { taskId: string } | { error: string } | null;
      if (!response.ok || !body || !("taskId" in body)) {
        setError(
          body && "error" in body ? body.error : "Could not start the task.",
        );
        return;
      }
      setGoal("");
      onTaskStarted(body.taskId);
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || disabled;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
      data-testid="task-composer"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Give the team a goal
      </h2>
      <textarea
        className="w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
        rows={2}
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        placeholder="e.g. Research three competitors and compare their pricing"
        disabled={busy}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {submitting ? "Submitting…" : disabled ? "Running…" : "Submit goal"}
      </button>
      {busy ? (
        <p className="text-xs text-muted">
          The manager is planning and the team is working — watch the office
          below as real Claude calls drive each agent.
        </p>
      ) : null}
    </form>
  );
}
