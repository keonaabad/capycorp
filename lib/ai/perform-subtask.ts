import Anthropic from "@anthropic-ai/sdk";
import { anthropic, requireModel } from "./client";
import { webSearch, type WebSearchResult } from "./tools/web-search";
import { calculate } from "./tools/calculator";
import { prepareTextFile, type TextFile } from "./tools/generate-file";
import type { SubtaskRole } from "./planner";

const MAX_TOOL_ITERATIONS = 4;
const WEB_SEARCH_TOOL_NAME = "web_search";
const CALCULATOR_TOOL_NAME = "calculator";
const GENERATE_FILE_TOOL_NAME = "generate_text_file";
const SUBMIT_RESULT_TOOL_NAME = "submit_structured_result";

/**
 * One named hook per real tool — not a dynamic registry, that's premature
 * for four tools (docs/architecture.md). Lets a caller (run-task-
 * orchestration.ts) observe/drive DB state (the `using_tool` transition,
 * AgentEvent writes) around each real tool execution without this file
 * importing Prisma — error-shaping into a tool_result stays this file's
 * job, state/DB stays the caller's.
 */
export interface SubtaskToolHooks {
  onWebSearch(
    query: string,
    run: () => Promise<WebSearchResult[]>,
  ): Promise<WebSearchResult[]>;
  onCalculate(
    expression: string,
    run: () => Promise<number>,
  ): Promise<number>;
  onGenerateFile(
    file: TextFile,
    run: () => Promise<TextFile>,
  ): Promise<TextFile>;
}

const defaultHooks: SubtaskToolHooks = {
  onWebSearch: (_query, run) => run(),
  onCalculate: (_expression, run) => run(),
  onGenerateFile: (_file, run) => run(),
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Validates and flattens a `submit_structured_result` call into plain
 * text for `Subtask.result` — the structure existed during the tool call
 * itself (a real JSON schema the model had to satisfy), it just isn't
 * persisted as JSON in this pass. A richer structured-data renderer is a
 * deferred follow-up, not a missing piece of this one.
 */
function formatStructuredResult(input: unknown): string {
  if (
    !input ||
    typeof input !== "object" ||
    !("summary" in input) ||
    !("items" in input)
  ) {
    throw new Error(
      "Structured result was malformed: missing summary or items.",
    );
  }
  const { summary, items } = input as Record<string, unknown>;
  if (
    typeof summary !== "string" ||
    !summary.trim() ||
    !Array.isArray(items)
  ) {
    throw new Error(
      "Structured result was malformed: invalid summary or items.",
    );
  }
  const lines = items.map((item, index) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as Record<string, unknown>).label !== "string" ||
      typeof (item as Record<string, unknown>).value !== "string"
    ) {
      throw new Error(
        `Structured result was malformed: invalid item at index ${index}.`,
      );
    }
    const { label, value } = item as { label: string; value: string };
    return `- ${label}: ${value}`;
  });
  return [summary.trim(), ...lines].join("\n");
}

/**
 * Has an agent do the work for a subtask via a real multi-turn tool-use
 * loop — the model decides whether it needs any tool at all (tool_choice:
 * auto, not forced) and can call more than one before giving a final
 * answer. `hooks` is partial and merged over `defaultHooks` so a caller
 * (or a test) only needs to supply the ones it actually cares about.
 */
export async function performSubtaskWork(
  subtask: { role: SubtaskRole; title: string; description: string },
  hooks: Partial<SubtaskToolHooks> = {},
): Promise<string> {
  const resolvedHooks: SubtaskToolHooks = { ...defaultHooks, ...hooks };
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `You are the ${subtask.role} on a small team at a business. You've been assigned this subtask:\n\nTitle: ${subtask.title}\nDetails: ${subtask.description}\n\nYou have real tools available: web_search, calculator, and generate_text_file — use whichever genuinely help, or none if you can just do the work directly. If your result is naturally a list or comparison, call submit_structured_result instead of writing free text. Otherwise, when finished, write a concise (2-4 sentence) summary of the work you completed.`,
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
        {
          name: CALCULATOR_TOOL_NAME,
          description:
            "Evaluate a basic arithmetic expression (+, -, *, /, %, parentheses). Use this instead of doing the math yourself when precision matters.",
          input_schema: {
            type: "object",
            properties: {
              expression: { type: "string" },
            },
            required: ["expression"],
          },
        },
        {
          name: GENERATE_FILE_TOOL_NAME,
          description:
            "Save a short text file as a deliverable for this task — e.g. a report, a list, or notes.",
          input_schema: {
            type: "object",
            properties: {
              filename: { type: "string" },
              content: { type: "string" },
            },
            required: ["filename", "content"],
          },
        },
        {
          name: SUBMIT_RESULT_TOOL_NAME,
          description:
            "Submit your final answer as structured data — a summary plus a list of labeled items — instead of free text, when the result is naturally a list or comparison.",
          input_schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    value: { type: "string" },
                  },
                  required: ["label", "value"],
                },
              },
            },
            required: ["summary", "items"],
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

    const submitBlock = toolUseBlocks.find(
      (block) =>
        block.type === "tool_use" && block.name === SUBMIT_RESULT_TOOL_NAME,
    );
    if (submitBlock && submitBlock.type === "tool_use") {
      return formatStructuredResult(submitBlock.input);
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

      if (block.name === WEB_SEARCH_TOOL_NAME) {
        const input = block.input as { query?: unknown };
        const query = typeof input.query === "string" ? input.query : "";
        try {
          const results = await resolvedHooks.onWebSearch(query, () =>
            webSearch(query),
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(results),
          });
        } catch (error) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: errorMessage(error, "Web search failed."),
            is_error: true,
          });
        }
        continue;
      }

      if (block.name === CALCULATOR_TOOL_NAME) {
        const input = block.input as { expression?: unknown };
        const expression =
          typeof input.expression === "string" ? input.expression : "";
        try {
          const result = await resolvedHooks.onCalculate(expression, () =>
            Promise.resolve(calculate(expression)),
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: String(result),
          });
        } catch (error) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: errorMessage(error, "Calculation failed."),
            is_error: true,
          });
        }
        continue;
      }

      if (block.name === GENERATE_FILE_TOOL_NAME) {
        const input = block.input as { filename?: unknown; content?: unknown };
        const filename =
          typeof input.filename === "string" ? input.filename : "";
        const content =
          typeof input.content === "string" ? input.content : "";
        try {
          const saved = await resolvedHooks.onGenerateFile(
            { filename, content },
            () => Promise.resolve(prepareTextFile(filename, content)),
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Saved ${saved.filename}.`,
          });
        } catch (error) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: errorMessage(error, "File generation failed."),
            is_error: true,
          });
        }
        continue;
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: `Unknown tool "${block.name}".`,
        is_error: true,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(
    `Exceeded ${MAX_TOOL_ITERATIONS} tool-use iterations without a final answer.`,
  );
}
