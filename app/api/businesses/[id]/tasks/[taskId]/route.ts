import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Polled by the client (~1.5s) while a task run is in flight. */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string; taskId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id: businessId, taskId } = await ctx.params;
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });
  // 404 (not 403) for both "doesn't exist" and "exists but not yours".
  if (!business || business.userId !== session.user.id) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.businessId !== businessId) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const agents = await prisma.agent.findMany({ where: { businessId } });
  const subtasks = await prisma.subtask.findMany({
    where: { taskId },
    include: { agent: { select: { name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    task: {
      id: task.id,
      status: task.status,
      error: task.error,
    },
    agents: agents.map((agent) => ({
      id: agent.id,
      state: agent.state,
      resumeState: agent.resumeState,
      currentTask: agent.currentTask,
    })),
    subtasks: subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      result: subtask.result,
      status: subtask.status,
      completedAt: subtask.completedAt,
      agent: subtask.agent,
    })),
  });
}
