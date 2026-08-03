"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ArchiveBusinessButton({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [archiving, setArchiving] = useState(false);

  async function handleArchive() {
    setArchiving(true);
    try {
      await fetch(`/api/businesses/${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      router.refresh();
    } finally {
      setArchiving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleArchive}
      disabled={archiving}
      className="rounded border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
    >
      {archiving ? "Archiving…" : "Archive"}
    </button>
  );
}
