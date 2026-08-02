import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playScript } from "./script-player";
import type { OfficeEventAdapter, OfficeSnapshot } from "./adapter";
import type { AgentState, TransitionResult } from "./state-machine";

function createRecordingAdapter() {
  const calls: string[] = [];
  const ok: TransitionResult = {
    ok: true,
    state: { current: "idle", resumeState: null },
  };

  const adapter: OfficeEventAdapter = {
    getSnapshot: (): OfficeSnapshot => ({ agents: {}, selectedAgentId: null }),
    subscribe: () => () => {},
    setAgentState: (agentId: string, to: AgentState) => {
      calls.push(`setState:${agentId}:${to}`);
      return ok;
    },
    pauseAgent: () => ok,
    resumeAgent: () => ok,
    resetAgent: (agentId: string) => {
      calls.push(`reset:${agentId}`);
      return ok;
    },
    setAgentTask: (agentId: string, task: string | null) => {
      calls.push(`task:${agentId}:${task ?? "null"}`);
    },
    selectAgent: () => {},
  };

  return { adapter, calls };
}

describe("playScript", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies each step at its scheduled time, not before", () => {
    const { adapter, calls } = createRecordingAdapter();
    playScript(adapter, [
      { atMs: 100, agentId: "manager", state: "assigned" },
      { atMs: 300, agentId: "manager", state: "walking_to_workstation" },
    ]);

    vi.advanceTimersByTime(99);
    expect(calls).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(calls).toEqual(["setState:manager:assigned"]);

    vi.advanceTimersByTime(200);
    expect(calls).toEqual([
      "setState:manager:assigned",
      "setState:manager:walking_to_workstation",
    ]);
  });

  it("calls setAgentTask when a step includes a task, including clearing it with null", () => {
    const { adapter, calls } = createRecordingAdapter();
    playScript(adapter, [
      { atMs: 0, agentId: "researcher", state: "assigned", task: "Dig in" },
    ]);

    vi.advanceTimersByTime(0);
    expect(calls).toEqual([
      "setState:researcher:assigned",
      "task:researcher:Dig in",
    ]);
  });

  it("stop() cancels pending steps", () => {
    const { adapter, calls } = createRecordingAdapter();
    const handle = playScript(adapter, [
      { atMs: 500, agentId: "manager", state: "assigned" },
    ]);

    vi.advanceTimersByTime(100);
    handle.stop();
    vi.advanceTimersByTime(1000);

    expect(calls).toEqual([]);
  });

  it("loops: resets touched agents and replays the script", () => {
    const { adapter, calls } = createRecordingAdapter();
    playScript(
      adapter,
      [{ atMs: 100, agentId: "manager", state: "assigned" }],
      { loop: true, loopDelayMs: 50 },
    );

    // First run.
    vi.advanceTimersByTime(100);
    expect(calls).toEqual(["setState:manager:assigned"]);

    // Loop boundary: total duration (100) + loopDelayMs (50) = 150 after start.
    vi.advanceTimersByTime(50);
    expect(calls).toEqual([
      "setState:manager:assigned",
      "reset:manager",
      "task:manager:null",
    ]);

    // Second run's step fires another 100ms later.
    vi.advanceTimersByTime(100);
    expect(calls).toEqual([
      "setState:manager:assigned",
      "reset:manager",
      "task:manager:null",
      "setState:manager:assigned",
    ]);
  });

  it("does not loop when loop is false", () => {
    const { adapter, calls } = createRecordingAdapter();
    playScript(adapter, [{ atMs: 10, agentId: "manager", state: "assigned" }]);

    vi.advanceTimersByTime(10);
    expect(calls).toEqual(["setState:manager:assigned"]);

    vi.advanceTimersByTime(10_000);
    expect(calls).toEqual(["setState:manager:assigned"]);
  });
});
