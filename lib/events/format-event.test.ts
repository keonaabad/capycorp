import { describe, expect, it } from "vitest";
import { formatEventLabel } from "./format-event";

describe("formatEventLabel", () => {
  it("formats agent.state_changed", () => {
    expect(
      formatEventLabel({
        type: "agent.state_changed",
        data: { from: "idle", to: "assigned" },
      }),
    ).toBe("idle → assigned");
  });

  it("formats agent.tool_started", () => {
    expect(
      formatEventLabel({
        type: "agent.tool_started",
        data: { tool: "web_search", query: "Tokyo weather" },
      }),
    ).toBe('Started web search: "Tokyo weather"');
  });

  it("formats a successful agent.tool_completed", () => {
    expect(
      formatEventLabel({
        type: "agent.tool_completed",
        data: { tool: "web_search", ok: true, resultCount: 5 },
      }),
    ).toBe("Finished web search — found 5 results");
  });

  it("formats a failed agent.tool_completed", () => {
    expect(
      formatEventLabel({
        type: "agent.tool_completed",
        data: {
          tool: "web_search",
          ok: false,
          error: "Tavily rate limit exceeded.",
        },
      }),
    ).toBe("web search failed: Tavily rate limit exceeded.");
  });

  it("falls back to a generic label for an unrecognized type", () => {
    expect(
      formatEventLabel({
        type: "agent.did_something_new",
        data: { foo: "bar" },
      }),
    ).toBe("Activity recorded");
  });

  it("falls back to a generic label when a recognized type has null data", () => {
    expect(formatEventLabel({ type: "agent.state_changed", data: null })).toBe(
      "Activity recorded",
    );
  });

  it("falls back to a generic label when a recognized type has malformed data", () => {
    expect(
      formatEventLabel({
        type: "agent.tool_completed",
        data: { unexpected: "shape" },
      }),
    ).toBe("Activity recorded");
  });
});
