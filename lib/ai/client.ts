import Anthropic from "@anthropic-ai/sdk";

const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic };

export const anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

if (process.env.NODE_ENV !== "production") {
  globalForAnthropic.anthropic = anthropic;
}

/**
 * Read at call time, not import time, so a missing model id fails loudly
 * on first use instead of a guessed default silently shipping in code —
 * the exact current Claude API model string isn't something to hardcode
 * from training data. Set ANTHROPIC_MODEL in .env from your Anthropic
 * console's model list.
 */
export function requireModel(): string {
  const model = process.env.ANTHROPIC_MODEL;
  if (!model) {
    throw new Error(
      "ANTHROPIC_MODEL is not set. Add it to .env with a current Claude model id from your Anthropic console.",
    );
  }
  return model;
}
