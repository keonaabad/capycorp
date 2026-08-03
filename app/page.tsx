import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { OfficeDemoPreview } from "@/components/office/office-demo-preview";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/business");
  }

  return (
    <div className="flex flex-1 flex-col bg-page text-ink">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <span className="text-sm font-semibold text-ink">CapyCorp</span>
          <Link href="/sign-in" className="text-sm text-muted hover:text-accent">
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-6 py-20 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            An AI agent ecosystem
          </p>
          <h1 className="text-3xl font-semibold text-balance sm:text-4xl">
            Build your own AI company and watch it work.
          </h1>
          <p className="max-w-xl text-base text-muted">
            CapyCorp is a visual multi-agent orchestration platform. Give
            your team a goal in plain language — a manager capybara plans
            the work and hands it off to the rest of your office, and you
            watch them research, design, and build in real time, driven by
            real Claude calls, not a canned animation.
          </p>
          <div className="flex w-full flex-col items-center gap-3 pt-2">
            <WaitlistForm />
            <Link
              href="/sign-in"
              className="text-xs text-muted hover:text-accent"
            >
              Already have access? Sign in
            </Link>
          </div>
        </section>

        <section className="border-t border-border py-14">
          <div className="mx-auto w-full max-w-5xl px-6">
            <h2 className="mb-1 text-lg font-semibold">See it in action</h2>
            <p className="mb-6 text-sm text-muted">
              This is the real office simulation, running a scripted demo
              task on a loop — a manager delegating research, design, and
              engineering work, an agent using a real tool, and a final
              approval, end to end. A live account gets its own office
              backed by a real manager, engineer, researcher, and designer.
            </p>
            <OfficeDemoPreview />
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted">
        CapyCorp ·{" "}
        <Link href="/sign-in" className="hover:text-accent">
          Sign in
        </Link>
      </footer>
    </div>
  );
}
