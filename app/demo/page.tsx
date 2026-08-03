import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OfficeExperience } from "@/components/office/office-experience";
import { TopNav } from "@/components/chrome/top-nav";

export default async function DemoPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <div className="flex flex-1 flex-col bg-page text-ink">
      <TopNav userEmail={session.user.email ?? ""} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-12">
        <header className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            CapyCorp · static office prototype
          </p>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            Build your own AI company and watch it work.
          </h1>
          <p className="max-w-2xl text-sm text-muted">
            This is Phase 1: a static, manually-driven office. Every capybara
            below is wired to the real strict agent state machine — the dev
            control panel triggers the same transitions a backend event stream
            will trigger later. Click a capybara to inspect it.
          </p>
          <Link
            href="/business"
            className="inline-block text-xs text-accent hover:underline"
          >
            ← Back to your businesses
          </Link>
        </header>
        <OfficeExperience />
      </main>
    </div>
  );
}
