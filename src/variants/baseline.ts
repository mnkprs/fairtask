import type { Variant } from "../lib/variant.ts";
import { RUBRIC } from "../lib/rubric.ts";
import { renderInstance } from "../lib/context.ts";
import { VERDICT_JSON_SCHEMA } from "../lib/verdict.ts";

/**
 * Baseline: one direct prompt, no tools, no repository access.
 * The model sees the same material and the same rubric as every other system.
 */
export const baseline: Variant = {
  name: "baseline",
  description: "Single prompt with the rubric and the task material; no tools, no repository access.",
  build(inst, ctx) {
    return {
      prompt: `${renderInstance(inst)}\nScore this candidate task on both axes and return the verdict.`,
      options: {
        model: ctx.model,
        systemPrompt: `${RUBRIC}\n\nAnswer with a JSON verdict matching the required schema.`,
        tools: [],
        outputFormat: { type: "json_schema", schema: VERDICT_JSON_SCHEMA },
        maxTurns: 3,
      },
    };
  },
};
