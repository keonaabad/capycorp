import { anthropic, requireModel } from "./client";
import type { AgentRole } from "@/lib/simulation/office-layout";

/** Only non-manager roles ever receive a subtask — the manager plans and reviews. */
export type SubtaskRole = Exclude<AgentRole, "manager">;

export interface PlannedSubtask {
  role: SubtaskRole;
  title: string;
  description: string;
}

const PLANNER_TOOL_NAME = "propose_subtasks";

/**
 * Asks Claude to break a goal into one subtask per relevant team member,
 * via a forced tool-use call so the response is structured JSON rather
 * than free text to parse. Only roles in `availableRoles` are offered —
 * the model may legitimately return fewer subtasks than roles available
 * if not every role is relevant to the goal.
 */
export async function planTask(
  goal: string,
  availableRoles: readonly SubtaskRole[],
): Promise<PlannedSubtask[]> {
  if (availableRoles.length === 0) {
    return [];
  }

  const response = await anthropic.messages.create({
    model: requireModel(),
    max_tokens: 1024,
    tools: [
      {
        name: PLANNER_TOOL_NAME,
        description:
          "Break the goal into one focused subtask per relevant team member. Only include roles that are actually needed for this goal — it's fine to return fewer subtasks than roles available.",
        input_schema: {
          type: "object",
          properties: {
            subtasks: {
              type: "array",
              minItems: 1,
              maxItems: availableRoles.length,
              items: {
                type: "object",
                properties: {
                  role: { type: "string", enum: availableRoles },
                  title: { type: "string" },
                  description: { type: "string" },
                },
                required: ["role", "title", "description"],
              },
            },
          },
          required: ["subtasks"],
        },
      },
    ],
    tool_choice: { type: "tool", name: PLANNER_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `You are the manager of a small team (${availableRoles.join(", ")}) at a business. A user submitted this goal:\n\n"${goal}"\n\nBreak it into a focused subtask for each team member whose skills are actually relevant. Keep titles short and descriptions to 1-2 sentences.`,
      },
    ],
  });

  const toolUseBlock = response.content.find(
    (block) => block.type === "tool_use",
  );
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("Planner did not return a structured plan.");
  }

  const input = toolUseBlock.input;
  if (
    !input ||
    typeof input !== "object" ||
    !("subtasks" in input) ||
    !Array.isArray((input as { subtasks: unknown }).subtasks)
  ) {
    throw new Error("Planner response was malformed: missing subtasks array.");
  }

  const subtasks: PlannedSubtask[] = [];
  for (const raw of (input as { subtasks: unknown[] }).subtasks) {
    if (
      !raw ||
      typeof raw !== "object" ||
      !("role" in raw) ||
      !("title" in raw) ||
      !("description" in raw)
    ) {
      throw new Error("Planner response was malformed: invalid subtask shape.");
    }
    const { role, title, description } = raw as Record<string, unknown>;
    if (
      typeof role !== "string" ||
      !availableRoles.includes(role as SubtaskRole) ||
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      throw new Error(
        "Planner response was malformed: invalid subtask fields.",
      );
    }
    subtasks.push({
      role: role as SubtaskRole,
      title: title.trim(),
      description: description.trim(),
    });
  }

  return subtasks;
}
