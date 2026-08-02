import { OfficeExperience } from "@/components/office/office-experience";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[#0e0b08] text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-12">
        <header className="space-y-2">
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
        </header>
        <OfficeExperience />
      </main>
    </div>
  );
}
