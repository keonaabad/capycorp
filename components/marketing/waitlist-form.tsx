"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json().catch(() => null)) as
        { error?: string }
        | null;
      if (!response.ok) {
        setError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p
        className="text-sm font-medium text-accent"
        data-testid="waitlist-success"
      >
        You&apos;re on the list — we&apos;ll be in touch.
      </p>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-2 sm:flex-row"
        data-testid="waitlist-form"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded border border-border bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Joining…" : "Join waitlist"}
        </button>
      </form>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
