import type { Variant } from "../lib/variant.ts";
import { v4Calibrated } from "./v4-calibrated.ts";

/**
 * Experiment — cost: the final pipeline with the two probes on Claude Sonnet 5 while the judge stays on the
 * run model. Tests whether the specialist work can be delegated to a cheaper model without losing agreement
 * with the human annotators.
 */
export const v5CheapProbes: Variant = {
  ...v4Calibrated,
  name: "v5-cheap-probes",
  description: "v4 with both probes on claude-sonnet-5 (judge unchanged) — cost experiment.",
  build(inst, ctx) {
    const built = v4Calibrated.build(inst, ctx);
    const agents = Object.fromEntries(Object.entries(built.options.agents ?? {}).map(([k, a]) => [k, { ...a, model: "claude-sonnet-5" }]));
    return { prompt: built.prompt, options: { ...built.options, agents } };
  },
};
