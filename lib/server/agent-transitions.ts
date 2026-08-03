import { Prisma } from "@/lib/generated/prisma/client";
import type { AgentRuntimeState } from "@/lib/simulation/state-machine";

/**
 * Persists an already-successful state-machine transition and writes the
 * matching AgentEvent, inside the caller's transaction. Takes a *computed*
 * `TransitionResult` rather than a transition function so callers check
 * `result.ok` first — an invalid transition never has to open a DB
 * transaction at all, it just short-circuits to an error response.
 *
 * Both the human-driven path (PATCH /api/agents/:id) and the AI-driven path
 * (the task orchestration route) call this, so persistence/event logic
 * can't drift between the two.
 */
export async function persistAgentTransition(
  tx: Prisma.TransactionClient,
  agent: { id: string; businessId: string },
  from: AgentRuntimeState["current"],
  to: AgentRuntimeState,
): Promise<void> {
  await tx.agent.update({
    where: { id: agent.id },
    data: {
      state: to.current,
      resumeState: to.resumeState,
    },
  });
  await tx.agentEvent.create({
    data: {
      businessId: agent.businessId,
      agentId: agent.id,
      type: "agent.state_changed",
      data: { from, to: to.current },
    },
  });
}
