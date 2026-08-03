import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";

/**
 * Persistent app chrome for every authenticated page. Deliberately thin —
 * page-specific headers (business name, task composer, etc.) stay on each
 * page, this only owns the wordmark and account controls.
 */
export function TopNav({ userEmail }: { userEmail: string }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/business" className="text-sm font-semibold text-ink">
          CapyCorp
        </Link>
        <div className="flex items-center gap-3 font-mono text-xs text-muted">
          <span>{userEmail}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
