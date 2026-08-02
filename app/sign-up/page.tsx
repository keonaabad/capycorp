"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setLoading(false);
      setError(body?.error ?? "Something went wrong. Try again.");
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Account created, but sign-in failed. Try signing in.");
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
          <h1 className="text-xl font-semibold">Create an account</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <label className="block text-xs uppercase tracking-wide text-white/50">
            Name (optional)
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded border border-white/15 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-lime-300"
            />
          </label>
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
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded border border-white/15 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-lime-300"
            />
          </label>
          <p className="text-[11px] text-white/30">At least 8 characters.</p>
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="text-center text-xs text-white/40">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-lime-300 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
