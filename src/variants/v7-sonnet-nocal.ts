import type { Variant } from "../lib/variant.ts";
import { v3Verify } from "./v3-verify.ts";

/**
 * Ablation — v3 (no calibration examples) with the two probes on Claude Sonnet 5 and the judge on the run model.
 * Isolates the probe-model change from the calibration memory, since v5 inherited v4's calibration examples.
 */
export const v7SonnetNocal: Variant = {
  ...v3Verify,
  name: "v7-sonnet-nocal",
  description: "v3 with both probes on claude-sonnet-5 (no calibration examples) — ablation isolating the probe model.",
  build(inst, ctx) {
    const built = v3Verify.build(inst, ctx);
    const agents = Object.fromEntries(Object.entries(built.options.agents ?? {}).map(([k, a]) => [k, { ...a, model: "claude-sonnet-5" }]));
    return { prompt: built.prompt, options: { ...built.options, agents } };
  },
};
