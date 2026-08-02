import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OfficeExperience } from "@/components/office/office-experience";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <div className="flex flex-1 flex-col bg-[#0e0b08] text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-12">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-widest text-lime-300">
              CapyCorp · static office prototype
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              Build your own AI company and watch it work.
            </h1>
            <p className="max-w-2xl text-sm text-white/60">
              This is Phase 1: a static, manually-driven office. Every capybara
              below is wired to the real strict agent state machine — the dev
              control panel triggers the same transitions a backend event stream
              will trigger later. Click a capybara to inspect it.
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs text-white/40">
            <span>{session.user.email}</span>
            <SignOutButton />
          </div>
        </header>
        <OfficeExperience />
      </main>
    </div>
  );
}
