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
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0e0b08] px-6 text-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-lime-300">
            CapyCorp
          </p>
          <h1 className="text-xl font-semibold">Sign in</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <label className="block text-xs uppercase tracking-wide text-white/50">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded border border-white/15 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-lime-300"
            />
          </label>
          <label className="block text-xs uppercase tracking-wide text-white/50">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded border border-white/15 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-lime-300"
            />
          </label>
          {error ? (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded border border-lime-300/60 px-3 py-2 text-sm font-medium text-lime-300 transition-colors hover:bg-lime-300/10 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-xs text-white/40">
          No account?{" "}
          <Link href="/sign-up" className="text-lime-300 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
