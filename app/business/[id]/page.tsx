import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BusinessOffice } from "@/components/office/business-office";
import { ROLE_ORDER, type AgentRole } from "@/lib/simulation/office-layout";
import type { BackendAgentSeed } from "@/lib/simulation/adapter";

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Auth is already checked once by app/business/layout.tsx — this page
  // only needs the session for the ownership check on the query below.
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
    redirect("/business");
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

  const artifacts = await prisma.artifact.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { agent: { select: { name: true, role: true } } },
  });

  const taskResults = await prisma.subtask.findMany({
    where: { task: { businessId: business.id } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { agent: { select: { name: true, role: true } } },
  });

  return (
    <BusinessOffice
      key={agentsFingerprint}
      businessId={business.id}
      businessName={business.name}
      agents={agents}
      events={events}
      artifacts={artifacts}
      taskResults={taskResults}
    />
  );
}
