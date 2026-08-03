import Anthropic from "@anthropic-ai/sdk";
import { anthropic, requireModel } from "./client";
import { webSearch, type WebSearchResult } from "./tools/web-search";
import type { SubtaskRole } from "./planner";

const MAX_TOOL_ITERATIONS = 4;
const WEB_SEARCH_TOOL_NAME = "web_search";

/**
 * A single wrapping hook for the one tool that exists — not a generic
 * registry, that's premature for one tool (docs/architecture.md). Lets a
 * caller (run-task-orchestration.ts) observe/drive DB state (the
 * `using_tool` transition, AgentEvent writes) around each real tool
 * execution without this file importing Prisma — error-shaping into a
 * tool_result stays this file's job, state/DB stays the caller's.
 */
export interface SubtaskToolHooks {
  onWebSearch(
    query: string,
    run: () => Promise<WebSearchResult[]>,
  ): Promise<WebSearchResult[]>;
}

const defaultHooks: SubtaskToolHooks = {
  onWebSearch: (_query, run) => run(),
};

/**
 * Has an agent do the work for a subtask via a real multi-turn tool-use
 * loop — the model decides whether it needs to search (tool_choice: auto,
 * not forced) and can search more than once before giving a final answer.
 */
export async function performSubtaskWork(
  subtask: { role: SubtaskRole; title: string; description: string },
  hooks: SubtaskToolHooks = defaultHooks,
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `You are the ${subtask.role} on a small team at a business. You've been assigned this subtask:\n\nTitle: ${subtask.title}\nDetails: ${subtask.description}\n\nYou have a real web_search tool available — use it if current information would genuinely help, otherwise just do the work directly. When finished, write a concise (2-4 sentence) summary of the work you completed.`,
    },
  ];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await anthropic.messages.create({
      model: requireModel(),
      max_tokens: 512,
      tools: [
        {
          name: WEB_SEARCH_TOOL_NAME,
          description:
            "Search the web for current information. Returns a short list of results, each with a title, url, and snippet.",
          input_schema: {
            type: "object",
            properties: {
              query: { type: "string" },
            },
            required: ["query"],
          },
        },
      ],
      tool_choice: { type: "auto" },
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Agent did not return a text result.");
      }
      return textBlock.text.trim();
    }

    const toolUseBlocks = response.content.filter(
      (block) => block.type === "tool_use",
    );
    if (toolUseBlocks.length === 0) {
      throw new Error(
        "Model signaled tool use but returned no tool_use block.",
      );
    }

    messages.push({
      role: "assistant",
      content: response.content
        .map((block) => {
          if (block.type === "tool_use") {
            return {
              type: "tool_use" as const,
              id: block.id,
              name: block.name,
              input: block.input,
            };
          }
          if (block.type === "text") {
            return { type: "text" as const, text: block.text };
          }
          return null;
        })
        .filter((block): block is NonNullable<typeof block> => block !== null),
    });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      if (block.type !== "tool_use") continue;
      const input = block.input as { query?: unknown };
      const query = typeof input.query === "string" ? input.query : "";

      try {
        const results = await hooks.onWebSearch(query, () => webSearch(query));
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(results),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Web search failed.";
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: message,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(
    `Exceeded ${MAX_TOOL_ITERATIONS} tool-use iterations without a final answer.`,
  );
}
