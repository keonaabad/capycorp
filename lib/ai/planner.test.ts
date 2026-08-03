import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("./client", () => ({
  anthropic: { messages: { create: createMock } },
  requireModel: () => "test-model",
}));

const { planTask } = await import("./planner");

function toolUseResponse(input: unknown) {
  return {
    content: [{ type: "tool_use", id: "t1", name: "propose_subtasks", input }],
  };
}

describe("planTask", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("returns [] without calling the model when no roles are available", async () => {
    const result = await planTask("Do something", []);
    expect(result).toEqual([]);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("parses a well-formed tool-use response into PlannedSubtask[]", async () => {
    createMock.mockResolvedValue(
      toolUseResponse({
        subtasks: [
          {
            role: "researcher",
            title: "  Research pricing  ",
            description: "  Compare three competitors.  ",
          },
        ],
      }),
    );

    const result = await planTask("Research competitor pricing", [
      "engineer",
      "researcher",
      "designer",
    ]);

    expect(result).toEqual([
      {
        role: "researcher",
        title: "Research pricing",
        description: "Compare three competitors.",
      },
    ]);
  });

  it("throws when the response has no tool_use block", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "sorry, I can't do that" }],
    });

    await expect(planTask("Do something", ["engineer"])).rejects.toThrow(
      /structured plan/,
    );
  });

  it("throws when subtasks is missing from the tool input", async () => {
    createMock.mockResolvedValue(toolUseResponse({}));

    await expect(planTask("Do something", ["engineer"])).rejects.toThrow(
      /missing subtasks array/,
    );
  });

  it("throws when a subtask has a role outside the available roles", async () => {
    createMock.mockResolvedValue(
      toolUseResponse({
        subtasks: [
          { role: "manager", title: "Plan it", description: "Plan the goal." },
        ],
      }),
    );

    await expect(planTask("Do something", ["engineer"])).rejects.toThrow(
      /invalid subtask fields/,
    );
  });
});
