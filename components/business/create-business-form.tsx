"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateBusinessForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Business name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry.trim() || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        { business: { id: string } } | { error: string } | null;
      if (!response.ok || !body || !("business" in body)) {
        setError(
          body && "error" in body ? body.error : "Could not create business.",
        );
        return;
      }
      router.push(`/business/${body.business.id}`);
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-white/10 p-4"
      data-testid="create-business-form"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
        Start a new business
      </h2>
      <label className="block text-[11px] uppercase tracking-wide text-white/40">
        Name
        <input
          className="mt-1 w-full rounded border border-white/15 bg-transparent px-2 py-1.5 text-sm text-white outline-none focus:border-lime-300"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Acme Widgets"
        />
      </label>
      <label className="block text-[11px] uppercase tracking-wide text-white/40">
        Industry (optional)
        <input
          className="mt-1 w-full rounded border border-white/15 bg-transparent px-2 py-1.5 text-sm text-white outline-none focus:border-lime-300"
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
          placeholder="e.g. E-commerce"
        />
      </label>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded border border-lime-300/60 px-3 py-1.5 text-xs font-medium text-lime-300 transition-colors hover:bg-lime-300/10 disabled:opacity-40"
      >
        {submitting ? "Creating…" : "Create business"}
      </button>
    </form>
  );
}
