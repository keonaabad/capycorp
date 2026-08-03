"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/business");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page px-6 text-ink">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface p-8">
        <div className="space-y-1 text-center">
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-widest text-accent"
          >
            CapyCorp
          </Link>
          <h1 className="text-xl font-semibold">Sign in</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <label className="block text-xs uppercase tracking-wide text-muted">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded border border-border bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="block text-xs uppercase tracking-wide text-muted">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded border border-border bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
          {error ? (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-accent px-3 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-xs text-muted">
          No account?{" "}
          <Link href="/sign-up" className="text-accent hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
