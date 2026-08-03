import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
const webSearchMock = vi.fn();

vi.mock("./client", () => ({
  anthropic: { messages: { create: createMock } },
  requireModel: () => "test-model",
}));
vi.mock("./tools/web-search", () => ({ webSearch: webSearchMock }));

const { performSubtaskWork } = await import("./perform-subtask");

const subtask = {
  role: "researcher" as const,
  title: "Research competitor pricing",
  description: "Find current pricing for three competitors.",
};

const context = {
  businessName: "Acme Widgets",
  goal: "Research three competitors and compare their pricing.",
};

function textResponse(text: string) {
  return { stop_reason: "end_turn", content: [{ type: "text", text }] };
}

function toolUseResponse(id: string, query: string) {
  return {
    stop_reason: "tool_use",
    content: [
      { type: "text", text: "Let me search for that." },
      { type: "tool_use", id, name: "web_search", input: { query } },
    ],
  };
}

function toolUseResponseFor(
  id: string,
  name: string,
  input: Record<string, unknown>,
) {
  return {
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id, name, input }],
  };
}

function lastMessageOf(callIndex: number) {
  const args = createMock.mock.calls[callIndex][0] as {
    messages: { content: unknown }[];
  };
  return args.messages[args.messages.length - 1];
}

describe("performSubtaskWork", () => {
  beforeEach(() => {
    createMock.mockReset();
    webSearchMock.mockReset();
  });

  it("returns the final text when the model doesn't need to search", async () => {
    createMock.mockResolvedValue(textResponse("Done, here's a summary."));

    const result = await performSubtaskWork(subtask, context);

    expect(result).toBe("Done, here's a summary.");
    expect(webSearchMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("executes a real search, then returns the final answer", async () => {
    createMock
      .mockResolvedValueOnce(toolUseResponse("tool-1", "competitor pricing"))
      .mockResolvedValueOnce(textResponse("Found it."));
    webSearchMock.mockResolvedValue([{ title: "t", url: "u", snippet: "s" }]);

    const result = await performSubtaskWork(subtask, context);

    expect(result).toBe("Found it.");
    expect(webSearchMock).toHaveBeenCalledWith("competitor pricing");
    const toolResultBlock = (
      lastMessageOf(1).content as { type: string; tool_use_id: string }[]
    )[0];
    expect(toolResultBlock).toMatchObject({
      type: "tool_result",
      tool_use_id: "tool-1",
    });
  });

  it("feeds a search failure back as an error tool_result instead of throwing", async () => {
    createMock
      .mockResolvedValueOnce(toolUseResponse("tool-1", "competitor pricing"))
      .mockResolvedValueOnce(textResponse("Answered without search."));
    webSearchMock.mockRejectedValue(new Error("Tavily rate limit exceeded."));

    const result = await performSubtaskWork(subtask, context);

    expect(result).toBe("Answered without search.");
    const toolResultBlock = (
      lastMessageOf(1).content as {
        type: string;
        tool_use_id: string;
        is_error?: boolean;
      }[]
    )[0];
    expect(toolResultBlock).toMatchObject({
      type: "tool_result",
      tool_use_id: "tool-1",
      is_error: true,
    });
  });

  it("throws instead of returning a truncated max_tokens response as a real answer", async () => {
    createMock.mockResolvedValue({
      stop_reason: "max_tokens",
      content: [{ type: "text", text: "Let me compile this into a" }],
    });

    await expect(performSubtaskWork(subtask, context)).rejects.toThrow(
      /cut off/i,
    );
  });

  it("throws after exceeding the tool-use iteration cap", async () => {
    createMock.mockResolvedValue(toolUseResponse("tool-x", "q"));
    webSearchMock.mockResolvedValue([]);

    await expect(performSubtaskWork(subtask, context)).rejects.toThrow(
      /iterations/,
    );
    expect(createMock).toHaveBeenCalledTimes(4);
  });

  it("routes searches through an explicit onWebSearch hook instead of the real call", async () => {
    createMock
      .mockResolvedValueOnce(toolUseResponse("tool-1", "competitor pricing"))
      .mockResolvedValueOnce(textResponse("Done."));
    const hookResults = [{ title: "hooked", url: "u", snippet: "s" }];
    const onWebSearch = vi.fn().mockResolvedValue(hookResults);

    const result = await performSubtaskWork(subtask, context, { onWebSearch });

    expect(result).toBe("Done.");
    expect(onWebSearch).toHaveBeenCalledWith(
      "competitor pricing",
      expect.any(Function),
    );
    expect(webSearchMock).not.toHaveBeenCalled();
    const toolResultBlock = (
      lastMessageOf(1).content as { content: string }[]
    )[0];
    expect(toolResultBlock.content).toBe(JSON.stringify(hookResults));
  });

  it("evaluates a real calculator call and feeds the result back", async () => {
    createMock
      .mockResolvedValueOnce(
        toolUseResponseFor("tool-1", "calculator", { expression: "2 + 2" }),
      )
      .mockResolvedValueOnce(textResponse("The total is 4."));

    const result = await performSubtaskWork(subtask, context);

    expect(result).toBe("The total is 4.");
    const toolResultBlock = (
      lastMessageOf(1).content as { content: string }[]
    )[0];
    expect(toolResultBlock.content).toBe("4");
  });

  it("feeds a calculator error back as an error tool_result instead of throwing", async () => {
    createMock
      .mockResolvedValueOnce(
        toolUseResponseFor("tool-1", "calculator", { expression: "5 / 0" }),
      )
      .mockResolvedValueOnce(textResponse("Couldn't compute that."));

    const result = await performSubtaskWork(subtask, context);

    expect(result).toBe("Couldn't compute that.");
    const toolResultBlock = (
      lastMessageOf(1).content as { content: string; is_error?: boolean }[]
    )[0];
    expect(toolResultBlock.is_error).toBe(true);
    expect(toolResultBlock.content).toMatch(/division by zero/i);
  });

  it("routes calculator calls through an explicit onCalculate hook", async () => {
    createMock
      .mockResolvedValueOnce(
        toolUseResponseFor("tool-1", "calculator", { expression: "2 + 2" }),
      )
      .mockResolvedValueOnce(textResponse("Done."));
    const onCalculate = vi.fn().mockResolvedValue(99);

    const result = await performSubtaskWork(subtask, context, { onCalculate });

    expect(result).toBe("Done.");
    expect(onCalculate).toHaveBeenCalledWith("2 + 2", expect.any(Function));
    const toolResultBlock = (
      lastMessageOf(1).content as { content: string }[]
    )[0];
    expect(toolResultBlock.content).toBe("99");
  });

  it("saves a real file via generate_text_file and feeds confirmation back", async () => {
    createMock
      .mockResolvedValueOnce(
        toolUseResponseFor("tool-1", "generate_text_file", {
          filename: "notes.txt",
          content: "Some findings.",
        }),
      )
      .mockResolvedValueOnce(textResponse("Saved the notes."));

    const result = await performSubtaskWork(subtask, context);

    expect(result).toBe("Saved the notes.");
    const toolResultBlock = (
      lastMessageOf(1).content as { content: string }[]
    )[0];
    expect(toolResultBlock.content).toBe("Saved notes.txt.");
  });

  it("routes file generation through an explicit onGenerateFile hook", async () => {
    createMock
      .mockResolvedValueOnce(
        toolUseResponseFor("tool-1", "generate_text_file", {
          filename: "notes.txt",
          content: "Some findings.",
        }),
      )
      .mockResolvedValueOnce(textResponse("Done."));
    const onGenerateFile = vi
      .fn()
      .mockResolvedValue({ filename: "notes.txt", content: "Some findings." });

    const result = await performSubtaskWork(subtask, context, {
      onGenerateFile,
    });

    expect(result).toBe("Done.");
    expect(onGenerateFile).toHaveBeenCalledWith(
      { filename: "notes.txt", content: "Some findings." },
      expect.any(Function),
    );
  });

  it("treats submit_structured_result as terminal and formats it, without a tool_result round trip", async () => {
    createMock.mockResolvedValueOnce(
      toolUseResponseFor("tool-1", "submit_structured_result", {
        summary: "Three competitors compared.",
        items: [
          { label: "Acme", value: "$10/mo" },
          { label: "Globex", value: "$12/mo" },
        ],
      }),
    );

    const result = await performSubtaskWork(subtask, context);

    expect(result).toBe(
      "Three competitors compared.\n- Acme: $10/mo\n- Globex: $12/mo",
    );
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("throws on a malformed submit_structured_result call", async () => {
    createMock.mockResolvedValueOnce(
      toolUseResponseFor("tool-1", "submit_structured_result", {
        summary: "",
        items: "not an array",
      }),
    );

    await expect(performSubtaskWork(subtask, context)).rejects.toThrow(
      /malformed/i,
    );
  });
});
