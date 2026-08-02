import type { OfficeEventAdapter } from "./adapter";
import type { ScriptStep } from "./demo-script";

export interface ScriptPlayerOptions {
  /** Replay the script indefinitely, resetting touched agents between runs. */
  loop?: boolean;
  /** Pause between the last step and the next run, in ms. Default 3000. */
  loopDelayMs?: number;
}

export interface ScriptPlayerHandle {
  stop: () => void;
}

/**
 * Plays a fixed timeline of state/task changes against an
 * OfficeEventAdapter, standing in for a real backend event stream. The
 * adapter's own transition rules still apply — a malformed script step
 * simply fails silently the same way an invalid dev-panel click would,
 * since both go through the same setAgentState/setAgentTask methods.
 */
export function playScript(
  adapter: OfficeEventAdapter,
  script: readonly ScriptStep[],
  options: ScriptPlayerOptions = {},
): ScriptPlayerHandle {
  const { loop = false, loopDelayMs = 3000 } = options;
  const touchedAgentIds = [...new Set(script.map((step) => step.agentId))];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let stopped = false;

  function schedule(delayMs: number, run: () => void) {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!stopped) run();
    }, delayMs);
    timers.add(id);
  }

  function runOnce() {
    for (const step of script) {
      schedule(step.atMs, () => {
        if (step.state) adapter.setAgentState(step.agentId, step.state);
        if (step.task !== undefined)
          adapter.setAgentTask(step.agentId, step.task);
      });
    }

    if (!loop) return;

    const totalDurationMs =
      Math.max(...script.map((step) => step.atMs)) + loopDelayMs;
    schedule(totalDurationMs, () => {
      for (const agentId of touchedAgentIds) {
        adapter.resetAgent(agentId);
        adapter.setAgentTask(agentId, null);
      }
      runOnce();
    });
  }

  runOnce();

  return {
    stop: () => {
      stopped = true;
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    },
  };
}
