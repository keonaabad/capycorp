import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BusinessOffice } from "@/components/office/business-office";
import { ActivityFeed } from "@/components/business/activity-feed";
import { ROLE_ORDER, type AgentRole } from "@/lib/simulation/office-layout";
import type { BackendAgentSeed } from "@/lib/simulation/adapter";

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const business = await prisma.business.findFirst({
    where: { id, userId: session.user.id },
    include: { agents: true },
  });

  if (!business) {
    redirect("/");
  }

  const roleRank = new Map<AgentRole, number>(
    ROLE_ORDER.map((role, index) => [role, index]),
  );
  const sortedAgents = [...business.agents].sort(
    (a, b) => (roleRank.get(a.role) ?? 0) - (roleRank.get(b.role) ?? 0),
  );
  const agents: BackendAgentSeed[] = sortedAgents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    state: agent.state,
    resumeState: agent.resumeState,
    currentTask: agent.currentTask,
  }));
  // BusinessOffice seeds its adapter's store once, in useState's
  // initializer — a bare router.refresh() re-runs this Server Component
  // but won't by itself reseed that client-side store. Keying on the
  // agents' updatedAt fingerprint forces a remount (and a fresh adapter)
  // whenever a task run actually changed their state.
  const agentsFingerprint = sortedAgents
    .map((agent) => `${agent.id}:${agent.updatedAt.toISOString()}`)
    .join(",");

  const events = await prisma.agentEvent.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { agent: { select: { name: true, role: true } } },
  });

  return (
    <div className="flex flex-1 flex-col bg-[#0e0b08] text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-12">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Link href="/" className="text-xs text-lime-300 hover:underline">
              ← All businesses
            </Link>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {business.name}
            </h1>
            {business.industry ? (
              <p className="text-sm text-white/60">{business.industry}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3 font-mono text-xs text-white/40">
            <span>{session.user.email}</span>
            <SignOutButton />
          </div>
        </header>
        <BusinessOffice
          key={agentsFingerprint}
          businessId={business.id}
          agents={agents}
        />
        <ActivityFeed events={events} />
      </main>
    </div>
  );
}
