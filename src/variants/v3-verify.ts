import type { Variant } from "../lib/variant.ts";
import { v2Specialists } from "./v2-specialists.ts";
import { verifyVerdict } from "../lib/verify.ts";

/**
 * Iteration 3 — verification: the v2 pipeline, plus an independent, deterministic check of every cited quote
 * against the repository and the patches. Failed checks are fed back and the judge must correct its verdict.
 */
export const v3Verify: Variant = {
  name: "v3-verify",
  description: "v2 + deterministic evidence verification (quotes must exist where cited; scores >= 2 need verified evidence) with feedback retries.",
  build: (inst, ctx) => {
    const built = v2Specialists.build(inst, ctx);
    return {
      prompt: built.prompt,
      options: {
        ...built.options,
        systemPrompt: `${built.options.systemPrompt}\n\n## Verification\nAfter you answer, a program checks every evidence item: the file must exist at the base commit, and the quote must appear verbatim there (for patches/issue: verbatim in that text). Scores of 2-3 without a verified evidence item are rejected and sent back to you. Cite precisely; "..." may elide text between verbatim fragments.`,
      },
    };
  },
  validate: (verdict, inst, ctx) => verifyVerdict(verdict, inst, ctx.workspace),
  maxRetries: 2,
};
