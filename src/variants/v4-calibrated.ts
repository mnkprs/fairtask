import type { Variant } from "../lib/variant.ts";
import { renderInstance } from "../lib/context.ts";
import { VERDICT_JSON_SCHEMA } from "../lib/verdict.ts";
import { verifyVerdict } from "../lib/verify.ts";
import { renderCalibration } from "../lib/calibration.ts";
import { JUDGE_PROMPT, SPEC_PROBE, TEST_PROBE, onlyDeclaredProbes } from "./v2-specialists.ts";

/**
 * Iteration 4 — memory/calibration: v3, plus each probe is shown how human annotators scored its axis on other
 * issues from the same repository (never the instance under test, never any evaluation instance).
 */
export const v4Calibrated: Variant = {
  name: "v4-calibrated",
  description: "v3 + per-repository calibration examples from human annotations injected into each probe (leakage-checked).",
  build(inst, ctx) {
    const specCal = renderCalibration(inst.repo, inst.instance_id, "underspecified");
    const testCal = renderCalibration(inst.repo, inst.instance_id, "false_negative");
    return {
      prompt: `${renderInstance(inst)}\nRun both probes on this candidate task, spot-check them, and return the verdict.`,
      options: {
        model: ctx.model,
        cwd: ctx.workspace,
        systemPrompt: `${JUDGE_PROMPT}\n\n## Verification\nAfter you answer, a program checks every evidence item: the file must exist at the base commit, and the quote must appear verbatim there (for patches/issue: verbatim in that text). Scores of 2-3 without a verified evidence item are rejected and sent back to you. Cite precisely; "..." may elide text between verbatim fragments.`,
        tools: ["Agent", "Read", "Grep", "Glob"],
        allowedTools: ["Agent", "Read", "Grep", "Glob"],
        agents: {
          "spec-probe": { ...SPEC_PROBE, model: ctx.model, prompt: `${SPEC_PROBE.prompt}\n\n${specCal}` },
          "test-probe": { ...TEST_PROBE, model: ctx.model, prompt: `${TEST_PROBE.prompt}\n\n${testCal}` },
        },
        hooks: { PreToolUse: [{ matcher: "Agent", hooks: [onlyDeclaredProbes] }] },
        outputFormat: { type: "json_schema", schema: VERDICT_JSON_SCHEMA },
        maxTurns: 80,
        maxBudgetUsd: 8,
      },
    };
  },
  validate: (verdict, inst, ctx) => verifyVerdict(verdict, inst, ctx.workspace),
  maxRetries: 2,
};
