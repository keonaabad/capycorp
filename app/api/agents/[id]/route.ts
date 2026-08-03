import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { persistAgentTransition } from "@/lib/server/agent-transitions";
import {
  AGENT_STATES,
  pause,
  reset,
  resume,
  setState,
  type AgentRuntimeState,
  type AgentState,
  type TransitionResult,
} from "@/lib/simulation/state-machine";

function isAgentState(value: unknown): value is AgentState {
  return (
    typeof value === "string" &&
    (AGENT_STATES as readonly string[]).includes(value)
  );
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const agent = await prisma.agent.findUnique({
    where: { id },
    include: { business: { select: { userId: true } } },
  });
  // 404 (not 403) for both "doesn't exist" and "exists but not yours".
  if (!agent || agent.business.userId !== session.user.id) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => null);
  const action =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).action
      : undefined;

  if (
    action !== "setState" &&
    action !== "pause" &&
    action !== "resume" &&
    action !== "reset" &&
    action !== "setTask"
  ) {
    return NextResponse.json(
      { error: `Unknown action "${String(action)}".` },
      { status: 400 },
    );
  }

  if (action === "setTask") {
    const task = (body as Record<string, unknown>).task;
    if (task !== null && typeof task !== "string") {
      return NextResponse.json(
        { error: '"task" must be a string or null.' },
        { status: 400 },
      );
    }
    const updated = await prisma.agent.update({
      where: { id },
      data: { currentTask: task },
    });
    return NextResponse.json({
      state: updated.state,
      resumeState: updated.resumeState,
      currentTask: updated.currentTask,
    });
  }

  const runtime: AgentRuntimeState = {
    current: agent.state,
    resumeState: agent.resumeState,
  };

  let result: TransitionResult;
  if (action === "setState") {
    const to = (body as Record<string, unknown>).to;
    if (!isAgentState(to)) {
      return NextResponse.json(
        { error: `"to" must be one of ${AGENT_STATES.join(", ")}.` },
        { status: 400 },
      );
    }
    result = setState(runtime, to);
  } else if (action === "pause") {
    result = pause(runtime);
  } else if (action === "resume") {
    result = resume(runtime);
  } else {
    result = reset(runtime);
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  await prisma.$transaction((tx) =>
    persistAgentTransition(tx, agent, runtime.current, result.state),
  );

  return NextResponse.json({
    state: result.state.current,
    resumeState: result.state.resumeState,
    // State transitions never touch currentTask — only the setTask action
    // does, and that branch already returned above.
    currentTask: agent.currentTask,
  });
}
