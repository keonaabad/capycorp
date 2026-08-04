import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { persistAgentTransition } from "@/lib/server/agent-transitions";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { reset } from "@/lib/simulation/state-machine";
import { runTaskOrchestration } from "./run-task-orchestration";

// Hobby plan's ceiling; raise if the account is on Pro (up to 800s, or
// 1800s under the extended-duration beta) and orchestrations start timing
// out in practice.
export const maxDuration = 300;

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const { id: businessId } = await ctx.params;
  // The business lookup doesn't depend on the session value — ownership
  // is checked below by comparing business.userId — so this runs
  // alongside auth() instead of after it.
  const [session, business] = await Promise.all([
    auth(),
    prisma.business.findUnique({
      where: { id: businessId },
      include: { agents: true },
    }),
  ]);
  console.error(`[timing] tasks: auth+business lookup took ${Date.now() - startedAt}ms`);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // 404 (not 403) for both "doesn't exist" and "exists but not yours".
  if (!business || business.userId !== session.user.id) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  const allowed = await checkRateLimit(`task:${session.user.id}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many tasks submitted — try again later." },
      { status: 429 },
    );
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
  // "completed" here would make its first real transition illegal). One
  // transaction for the whole loop rather than one per agent — up to 4
  // round trips down to 1.
  const resetStartedAt = Date.now();
  await prisma.$transaction(async (tx) => {
    for (const agentRow of business.agents) {
      if (agentRow.state === "idle") continue;
      const result = reset({
        current: agentRow.state,
        resumeState: agentRow.resumeState,
      });
      if (result.ok) {
        await persistAgentTransition(tx, agentRow, agentRow.state, result.state);
        agentRow.state = result.state.current;
        agentRow.resumeState = result.state.resumeState;
      }
    }
  });
  console.error(`[timing] tasks: reset transaction took ${Date.now() - resetStartedAt}ms`);

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

  // Runs after the response is sent, via next/server's after(). On Vercel
  // this is backed by waitUntil(), which keeps the serverless invocation
  // alive until the promise settles or maxDuration is hit — unlike a bare
  // fire-and-forget promise, which only survived on a long-lived
  // next dev/next start process and would be killed the instant a
  // serverless function returned. A dev-server file-save mid-run can still
  // abandon this, leaving the Task stuck at "running" and its agents
  // non-idle — the existing midRun 409 check above is what surfaces that
  // if it happens, by design, not a bug.
  after(() =>
    runTaskOrchestration(
      task.id,
      business.name,
      manager,
      agentsByRole,
      trimmedGoal,
    ).catch((error: unknown) => {
      console.error("Unhandled task orchestration error", error);
    }),
  );

  return NextResponse.json({ taskId: task.id }, { status: 202 });
}
