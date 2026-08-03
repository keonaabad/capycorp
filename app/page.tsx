import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { CreateBusinessForm } from "@/components/business/create-business-form";
import { ArchiveBusinessButton } from "@/components/business/archive-business-button";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const businesses = await prisma.business.findMany({
    where: { userId: session.user.id, archived: false },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-1 flex-col bg-[#0e0b08] text-white">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-widest text-lime-300">
              CapyCorp
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              Your businesses
            </h1>
            <p className="max-w-2xl text-sm text-white/60">
              Each business gets its own office and starter team of four agents.
              Select one to open its office, or start a new one below.
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs text-white/40">
            <span>{session.user.email}</span>
            <SignOutButton />
          </div>
        </header>

        <div className="space-y-3">
          {businesses.length === 0 ? (
            <p
              className="rounded-md border border-dashed border-white/15 p-4 text-sm text-white/50"
              data-testid="no-businesses"
            >
              No businesses yet — create one below.
            </p>
          ) : (
            businesses.map((business) => (
              <div
                key={business.id}
                className="flex items-center justify-between rounded-md border border-white/10 p-4"
                data-testid={`business-${business.id}`}
              >
                <Link
                  href={`/business/${business.id}`}
                  className="space-y-1 hover:text-lime-300"
                >
                  <p className="font-medium">{business.name}</p>
                  {business.industry ? (
                    <p className="text-xs text-white/40">{business.industry}</p>
                  ) : null}
                </Link>
                <ArchiveBusinessButton businessId={business.id} />
              </div>
            ))
          )}
        </div>

        <CreateBusinessForm />

        <Link
          href="/demo"
          className="text-xs text-white/40 hover:text-lime-300"
        >
          Or view the Phase 1 scripted demo →
        </Link>
      </main>
    </div>
  );
}
