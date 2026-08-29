import type { Variant } from "../lib/variant.ts";
import { v4Calibrated } from "./v4-calibrated.ts";

/**
 * Iteration 6 — target definition: v4, plus every agent is told what the reference label actually is — the MAXIMUM
 * severity assigned by any of three independent professional annotators. A score of 2 is therefore warranted
 * whenever a careful, strict annotator could reasonably give it, not only when the agent itself would.
 * (This is a property of the ground truth documented with the dataset, not something tuned on results.)
 */
export const TARGET_DEFINITION = `## What the reference label means
Your scores are compared with human labels that are the MAXIMUM severity given by any of three independent,
experienced engineers who reviewed the same material. In practice that means:
- Score 2 on an axis if a careful, strict reviewer could reasonably argue for it — even if you personally lean 1.
  "Some blanks" (1) becomes "vague" (2) when a competent engineer could build the wrong thing in good faith.
- For the test axis, a single name, message, or return-value detail that only the gold patch introduces is enough for
  a strict reviewer to give a 2; do not talk yourself down to 1 because the alternative "would probably be rare".
- Score 0 only when you cannot construct any reasonable objection at all.`;

export const v6TargetAware: Variant = {
  ...v4Calibrated,
  name: "v6-target-aware",
  description: "v4 + every agent told the reference label is the max over three annotators (strict-reviewer framing).",
  build(inst, ctx) {
    const built = v4Calibrated.build(inst, ctx);
    const agents = Object.fromEntries(Object.entries(built.options.agents ?? {}).map(([k, a]) => [k, { ...a, prompt: `${a.prompt}\n\n${TARGET_DEFINITION}` }]));
    return { prompt: built.prompt, options: { ...built.options, systemPrompt: `${built.options.systemPrompt}\n\n${TARGET_DEFINITION}`, agents } };
  },
};
