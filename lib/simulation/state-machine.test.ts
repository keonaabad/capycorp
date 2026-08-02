import { describe, expect, it } from "vitest";
import {
  canTransition,
  createInitialRuntimeState,
  isTerminal,
  pause,
  reset,
  resume,
  setState,
} from "./state-machine";

describe("createInitialRuntimeState", () => {
  it("starts idle with no resume state", () => {
    expect(createInitialRuntimeState()).toEqual({
      current: "idle",
      resumeState: null,
    });
  });
});

describe("setState", () => {
  it("allows a valid forward transition", () => {
    const result = setState(createInitialRuntimeState(), "assigned");
    expect(result).toEqual({
      ok: true,
      state: { current: "assigned", resumeState: null },
    });
  });

  it("rejects an invalid transition", () => {
    const result = setState(createInitialRuntimeState(), "working");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Invalid transition/);
    }
  });

  it("walks the full happy path from idle to completed", () => {
    const path = [
      "assigned",
      "walking_to_workstation",
      "planning",
      "working",
      "needs_approval",
      "completed",
    ] as const;

    let runtime = createInitialRuntimeState();
    for (const next of path) {
      const result = setState(runtime, next);
      expect(
        result.ok,
        `expected ${runtime.current} -> ${next} to succeed`,
      ).toBe(true);
      if (result.ok) runtime = result.state;
    }
    expect(runtime.current).toBe("completed");
  });

  it("allows working to detour through using_tool and back", () => {
    let runtime = createInitialRuntimeState();
    for (const next of [
      "assigned",
      "walking_to_workstation",
      "planning",
      "working",
    ] as const) {
      const result = setState(runtime, next);
      if (result.ok) runtime = result.state;
    }

    const toTool = setState(runtime, "using_tool");
    expect(toTool.ok).toBe(true);
    if (toTool.ok) runtime = toTool.state;

    const backToWork = setState(runtime, "working");
    expect(backToWork.ok).toBe(true);
  });

  it("rejects any transition out of a terminal state", () => {
    const completed = { current: "completed" as const, resumeState: null };
    const result = setState(completed, "working");
    expect(result.ok).toBe(false);
  });

  it("rejects direct transitions while paused", () => {
    const paused = {
      current: "paused" as const,
      resumeState: "working" as const,
    };
    const result = setState(paused, "working");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/paused/);
    }
  });
});

describe("pause / resume", () => {
  it("pauses a working agent and remembers the state to resume into", () => {
    const working = { current: "working" as const, resumeState: null };
    const result = pause(working);
    expect(result).toEqual({
      ok: true,
      state: { current: "paused", resumeState: "working" },
    });
  });

  it("resumes back to the remembered state", () => {
    const paused = {
      current: "paused" as const,
      resumeState: "collaborating" as const,
    };
    const result = resume(paused);
    expect(result).toEqual({
      ok: true,
      state: { current: "collaborating", resumeState: null },
    });
  });

  it("refuses to pause idle agents", () => {
    const result = pause(createInitialRuntimeState());
    expect(result.ok).toBe(false);
  });

  it("refuses to pause an already-paused agent", () => {
    const paused = {
      current: "paused" as const,
      resumeState: "working" as const,
    };
    const result = pause(paused);
    expect(result.ok).toBe(false);
  });

  it("refuses to pause a terminal state", () => {
    const completed = { current: "completed" as const, resumeState: null };
    const result = pause(completed);
    expect(result.ok).toBe(false);
  });

  it("refuses to resume a non-paused agent", () => {
    const working = { current: "working" as const, resumeState: null };
    const result = resume(working);
    expect(result.ok).toBe(false);
  });
});

describe("reset", () => {
  it("resets a completed agent back to idle", () => {
    const completed = { current: "completed" as const, resumeState: null };
    expect(reset(completed)).toEqual({
      ok: true,
      state: { current: "idle", resumeState: null },
    });
  });

  it("resets a failed agent back to idle", () => {
    const failed = { current: "failed" as const, resumeState: null };
    expect(reset(failed)).toEqual({
      ok: true,
      state: { current: "idle", resumeState: null },
    });
  });

  it("is a no-op for an already-idle agent", () => {
    expect(reset(createInitialRuntimeState())).toEqual({
      ok: true,
      state: { current: "idle", resumeState: null },
    });
  });

  it("refuses to reset an agent mid-task", () => {
    const working = { current: "working" as const, resumeState: null };
    const result = reset(working);
    expect(result.ok).toBe(false);
  });

  it("refuses to reset a paused agent", () => {
    const paused = {
      current: "paused" as const,
      resumeState: "working" as const,
    };
    const result = reset(paused);
    expect(result.ok).toBe(false);
  });
});

describe("canTransition", () => {
  it("reflects the same rules setState enforces", () => {
    expect(canTransition("idle", "assigned")).toBe(true);
    expect(canTransition("idle", "working")).toBe(false);
    expect(canTransition("completed", "working")).toBe(false);
  });
});

describe("isTerminal", () => {
  it("flags completed and failed as terminal", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("working")).toBe(false);
  });
});
