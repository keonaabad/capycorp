import { prisma } from "@/lib/prisma";
import { persistAgentTransition } from "@/lib/server/agent-transitions";
import {
  planTask,
  type PlannedSubtask,
  type SubtaskRole,
} from "@/lib/ai/planner";
import { performSubtaskWork } from "@/lib/ai/perform-subtask";
import {
  setState,
  type AgentRuntimeState,
  type AgentState,
} from "@/lib/simulation/state-machine";
import type { Agent } from "@/lib/generated/prisma/client";

export const NON_MANAGER_ROLES: readonly SubtaskRole[] = [
  "engineer",
  "researcher",
  "designer",
];

export interface OrchestrationResult {
  status: "completed" | "failed";
  subtaskResults: { ok: boolean; title: string }[];
}

/** Applies a sequence of legal transitions, persisting each step, returning the final runtime. */
async function driveAgentStates(
  agentRow: Pick<Agent, "id" | "businessId">,
  from: AgentRuntimeState,
  toStates: readonly AgentState[],
): Promise<AgentRuntimeState> {
  let runtime = from;
  for (const to of toStates) {
    const result = setState(runtime, to);
    if (!result.ok) {
      throw new Error(
        `Unexpected transition failure driving agent ${agentRow.id} to "${to}": ${result.reason}`,
      );
    }
    await prisma.$transaction((tx) =>
      persistAgentTransition(tx, agentRow, runtime.current, result.state),
    );
    runtime = result.state;
  }
  return runtime;
}

async function runSubtask(
  taskId: string,
  agentRow: Agent,
  planned: PlannedSubtask,
): Promise<{ ok: boolean; title: string }> {
  const subtask = await prisma.subtask.create({
    data: {
      taskId,
      agentId: agentRow.id,
      title: planned.title,
      description: planned.description,
      status: "running",
    },
  });

  let runtime: AgentRuntimeState = {
    current: agentRow.state,
    resumeState: agentRow.resumeState,
  };

  try {
    runtime = await driveAgentStates(agentRow, runtime, [
      "assigned",
      "walking_to_workstation",
      "planning",
      "working",
    ]);
    const result = await performSubtaskWork(planned, {
      // Fired once per *actual* search the model runs — not once per
      // subtask — so working<->using_tool visibly cycles for every real
      // call, matching what's actually happening rather than a single
      // decorative blip.
      async onWebSearch(query, run) {
        runtime = await driveAgentStates(agentRow, runtime, ["using_tool"]);
        await prisma.agentEvent.create({
          data: {
            businessId: agentRow.businessId,
            agentId: agentRow.id,
            taskId,
            type: "agent.tool_started",
            data: { tool: "web_search", query },
          },
        });
        try {
          const results = await run();
          await prisma.agentEvent.create({
            data: {
              businessId: agentRow.businessId,
              agentId: agentRow.id,
              taskId,
              type: "agent.tool_completed",
              data: {
                tool: "web_search",
                query,
                ok: true,
                resultCount: results.length,
              },
            },
          });
          return results;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Web search failed.";
          await prisma.agentEvent.create({
            data: {
              businessId: agentRow.businessId,
              agentId: agentRow.id,
              taskId,
              type: "agent.tool_completed",
              data: { tool: "web_search", query, ok: false, error: message },
            },
          });
          throw error;
        } finally {
          runtime = await driveAgentStates(agentRow, runtime, ["working"]);
        }
      },
    });
    await prisma.subtask.update({
      where: { id: subtask.id },
      data: { result, status: "completed", completedAt: new Date() },
    });
    await driveAgentStates(agentRow, runtime, ["completed"]);
    await prisma.agent.update({
      where: { id: agentRow.id },
      data: { currentTask: result },
    });
    return { ok: true, title: planned.title };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Subtask failed.";
    await prisma.subtask.update({
      where: { id: subtask.id },
      data: { status: "failed", result: message, completedAt: new Date() },
    });
    try {
      await driveAgentStates(agentRow, runtime, ["failed"]);
      await prisma.agent.update({
        where: { id: agentRow.id },
        data: { currentTask: `Failed: ${message}` },
      });
    } catch {
      // Best-effort — if even marking the agent failed isn't a legal
      // transition from wherever it got stuck, leave it as-is rather than
      // throwing out of a subtask that's already being reported as failed.
    }
    return { ok: false, title: planned.title };
  }
}

/**
 * The full plan -> drive -> work -> complete loop for a task. Called
 * fire-and-forget from route.ts's POST handler, running detached from the
 * request that created it — see route.ts for why that's safe here (a
 * long-lived Node process) and where it wouldn't be (serverless).
 *
 * Must never call anything depending on Next.js's request-scoped
 * AsyncLocalStorage (auth(), cookies(), headers()) — those become invalid
 * once the response is sent. Only plain, already-resolved objects come in.
 */
export async function runTaskOrchestration(
  taskId: string,
  manager: Agent,
  agentsByRole: ReadonlyMap<SubtaskRole | "manager", Agent>,
  goal: string,
): Promise<OrchestrationResult> {
  const availableRoles = NON_MANAGER_ROLES.filter((role) =>
    agentsByRole.has(role),
  );

  try {
    const plannedSubtasks = await planTask(goal, availableRoles);

    let managerRuntime: AgentRuntimeState = {
      current: manager.state,
      resumeState: manager.resumeState,
    };
    managerRuntime = await driveAgentStates(manager, managerRuntime, [
      "assigned",
      "walking_to_workstation",
      "planning",
      "working",
    ]);
    await prisma.agent.update({
      where: { id: manager.id },
      data: {
        currentTask:
          plannedSubtasks.length > 0
            ? `Delegating: ${plannedSubtasks.map((s) => s.title).join("; ")}`
            : "No subtasks needed for this goal.",
      },
    });

    const validSubtasks = plannedSubtasks.filter((planned) =>
      agentsByRole.has(planned.role),
    );
    const subtaskResults = await Promise.all(
      validSubtasks.map((planned) =>
        runSubtask(taskId, agentsByRole.get(planned.role) as Agent, planned),
      ),
    );
    const anyFailed = subtaskResults.some((r) => !r.ok);

    await driveAgentStates(manager, managerRuntime, ["completed"]);
    await prisma.agent.update({
      where: { id: manager.id },
      data: {
        currentTask:
          subtaskResults.length > 0
            ? `Wrapped up: ${subtaskResults.map((r) => r.title).join("; ")}`
            : "No subtasks were needed for this goal.",
      },
    });

    const status = anyFailed ? "failed" : "completed";
    await prisma.task.update({
      where: { id: taskId },
      data: { status, completedAt: new Date() },
    });
    return { status, subtaskResults };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task failed.";
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "failed", error: message, completedAt: new Date() },
    });
    return { status: "failed", subtaskResults: [] };
  }
}
