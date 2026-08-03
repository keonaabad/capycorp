import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { persistAgentTransition } from "@/lib/server/agent-transitions";
import { reset } from "@/lib/simulation/state-machine";
import { runTaskOrchestration } from "./run-task-orchestration";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id: businessId } = await ctx.params;
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { agents: true },
  });
  // 404 (not 403) for both "doesn't exist" and "exists but not yours".
  if (!business || business.userId !== session.user.id) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => null);
  const goal =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).goal
      : undefined;
  if (typeof goal !== "string" || !goal.trim()) {
    return NextResponse.json({ error: "A goal is required." }, { status: 400 });
  }
  const trimmedGoal = goal.trim();

  const manager = business.agents.find((a) => a.role === "manager");
  if (!manager) {
    return NextResponse.json(
      { error: "This business has no manager agent." },
      { status: 500 },
    );
  }

  const midRun = business.agents.some(
    (a) =>
      a.state !== "idle" && a.state !== "completed" && a.state !== "failed",
  );
  if (midRun) {
    return NextResponse.json(
      { error: "A task is already running for this business." },
      { status: 409 },
    );
  }

  // Reset anyone left over (completed/failed) from a previous run. Mutate
  // agentRow in place after persisting — `manager`/`agentsByRole` below are
  // built from these same object references, and runTaskOrchestration
  // needs their *current* state, not the stale pre-reset snapshot (a stale
  // "completed" here would make its first real transition illegal).
  for (const agentRow of business.agents) {
    if (agentRow.state === "idle") continue;
    const result = reset({
      current: agentRow.state,
      resumeState: agentRow.resumeState,
    });
    if (result.ok) {
      await prisma.$transaction((tx) =>
        persistAgentTransition(tx, agentRow, agentRow.state, result.state),
      );
      agentRow.state = result.state.current;
      agentRow.resumeState = result.state.resumeState;
    }
  }

  const title =
    trimmedGoal.length > 80 ? `${trimmedGoal.slice(0, 77)}...` : trimmedGoal;
  const task = await prisma.task.create({
    data: {
      businessId,
      title,
      goal: trimmedGoal,
      status: "running",
      startedAt: new Date(),
    },
  });

  const agentsByRole = new Map(business.agents.map((a) => [a.role, a]));

  // Fire-and-forget: this only works because this is a long-lived
  // next dev/next start Node process — nothing kills it after the response
  // is sent, so this pending promise keeps running. A serverless deploy
  // (e.g. Vercel) would need a real background-job system instead; that's
  // a known, intentional gap for this local-dev-scoped milestone, not an
  // oversight. A dev-server file-save mid-run can also abandon this promise
  // entirely, leaving the Task stuck at "running" and its agents non-idle
  // — the existing midRun 409 check above is what surfaces that if it
  // happens, by design, not a bug.
  void runTaskOrchestration(task.id, manager, agentsByRole, trimmedGoal).catch(
    (error: unknown) => {
      console.error("Unhandled task orchestration error", error);
    },
  );

  return NextResponse.json({ taskId: task.id }, { status: 202 });
}
