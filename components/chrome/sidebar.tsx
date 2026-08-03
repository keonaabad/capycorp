"use client";

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
 */
export function Sidebar({
  businesses,
  userEmail,
}: {
  businesses: readonly SidebarBusiness[];
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-4 py-4">
        <Link href="/business" className="text-sm font-semibold text-ink">
          CapyCorp
        </Link>
      </div>

      <div className="px-3 pb-2">
        <Link
          href="/business"
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
                <Link href={href} className="min-w-0 flex-1 truncate">
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
  );
}
