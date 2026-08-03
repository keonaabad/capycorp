"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ArchiveBusinessButton } from "@/components/business/archive-business-button";

export interface SidebarBusiness {
  id: string;
  name: string;
  industry: string | null;
}

/**
 * The persistent left rail for the whole authenticated app shell —
 * ChatGPT/Claude's pattern: always visible, click a business the way
 * you'd click a conversation. A client component so it can read the
 * current path via usePathname() to highlight the active business,
 * rather than threading an active-id prop down through the layout tree.
 *
 * Below md, a fixed-width 256px rail permanently on screen leaves almost
 * no room for the office itself, so it becomes a slide-over drawer here
 * instead — a fixed top bar with a toggle, a backdrop, and the same
 * `<aside>` content repositioned to `fixed` and slid off-screen until
 * opened. At md+ it's `static` and always visible, unchanged from before.
 */
export function Sidebar({
  businesses,
  userEmail,
}: {
  businesses: readonly SidebarBusiness[];
  userEmail: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 md:hidden">
        <Link href="/business" className="text-sm font-semibold text-ink">
          CapyCorp
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink"
          aria-label="Open menu"
        >
          Menu
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar transition-transform duration-200 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/business" className="text-sm font-semibold text-ink">
            CapyCorp
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-muted hover:text-ink md:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="px-3 pb-2">
          <Link
            href="/business"
            onClick={() => setOpen(false)}
            className="block rounded-lg border border-border px-3 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
          >
            + New business
          </Link>
        </div>

        <nav
          className="flex-1 space-y-1 overflow-y-auto px-3 py-2"
          data-testid="sidebar-businesses"
        >
          {businesses.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted">No businesses yet.</p>
          ) : (
            businesses.map((business) => {
              const href = `/business/${business.id}`;
              const active = pathname === href;
              return (
                <div
                  key={business.id}
                  className={`group flex items-center justify-between gap-1 rounded-lg px-3 py-2 text-sm ${
                    active
                      ? "bg-active text-ink"
                      : "text-muted hover:bg-active hover:text-ink"
                  }`}
                  data-testid={`sidebar-business-${business.id}`}
                >
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="min-w-0 flex-1 truncate"
                  >
                    {business.name}
                  </Link>
                  <span className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <ArchiveBusinessButton businessId={business.id} />
                  </span>
                </div>
              );
            })
          )}
        </nav>

        <div className="border-t border-border px-4 py-3">
          <Link
            href="/demo"
            onClick={() => setOpen(false)}
            className="mb-2 block text-xs text-muted hover:text-accent"
          >
            Phase 1 scripted demo →
          </Link>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-xs text-muted">
              {userEmail}
            </span>
            <SignOutButton />
          </div>
        </div>
      </aside>
    </>
  );
}
