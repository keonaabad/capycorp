"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/sign-in" })}
      className="rounded border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
    >
      Sign out
    </button>
  );
}
