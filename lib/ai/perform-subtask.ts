import { anthropic, requireModel } from "./client";
import type { SubtaskRole } from "./planner";

/**
 * Simulates an agent doing the work for a subtask — a single plain-text
 * Claude call, explicitly framed as having no real external side effects.
 * A real tool registry (web search, file generation, etc.) is out of scope
 * for this pass; this is the "mocked tool call" the product proposal
 * describes as acceptable for an early build.
 */
export async function performSubtaskWork(subtask: {
  role: SubtaskRole;
  title: string;
  description: string;
}): Promise<string> {
  const response = await anthropic.messages.create({
    model: requireModel(),
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are the ${subtask.role} on a small team at a business. You've been assigned this subtask:\n\nTitle: ${subtask.title}\nDetails: ${subtask.description}\n\nThis is a simulated task — no real external tools or side effects are available yet. Write a concise (2-4 sentence) summary of the work you completed, as if you had just finished it.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Agent did not return a text result.");
  }
  return textBlock.text.trim();
}
