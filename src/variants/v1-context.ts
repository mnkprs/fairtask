import type { Variant } from "../lib/variant.ts";
import { RUBRIC } from "../lib/rubric.ts";
import { renderInstance } from "../lib/context.ts";
import { VERDICT_JSON_SCHEMA } from "../lib/verdict.ts";

export const INVESTIGATION_PROCEDURE = `## How to investigate (you have read-only access to the repository at the base commit; cwd is the repo root)
Do not score from the issue and patches alone — the human annotators had the codebase open, and so do you.
1. Locate the code the issue is about (Grep for the symbols, paths and messages it mentions). Read enough of it to
   know what a solver would actually have to change.
2. Read the test patch against the real test files. For every new/changed assertion, ask: does the issue text tell the
   solver about this name, parameter, return value, error type, message wording, or output format? If it comes only
   from the gold patch, that is a false-negative risk — unless the repository's existing conventions make it the only
   natural choice (check: are there sibling APIs with the same naming pattern?).
3. Think of at least two different fixes a competent engineer could reasonably write from the issue alone
   (different parameter name, different location for the fix, different error type, fixing only the reported case vs.
   the general case). Would the tests accept each? A reasonable fix the tests reject raises false_negative.
4. For underspecified: list what the issue leaves open (expected behaviour, scope, edge cases, which of several
   plausible interpretations is wanted) and whether the codebase resolves that ambiguity for a careful reader.
5. Score conservatively but not paranoidly: a name the issue itself proposes, or that follows an obvious existing
   convention, is NOT a discrepancy.

Every score of 2 or 3 must be backed by evidence items whose quotes are verbatim from the cited location.`;

/**
 * Iteration 1 — better context: the same single agent, now with read-only tools on the checked-out repository
 * and an explicit investigation procedure.
 */
export const v1Context: Variant = {
  name: "v1-context",
  description: "Single agent with read-only repository tools (Read/Grep/Glob) and an investigation procedure.",
  build(inst, ctx) {
    return {
      prompt: `${renderInstance(inst)}\nInvestigate the repository as instructed, then return the verdict.`,
      options: {
        model: ctx.model,
        cwd: ctx.workspace,
        systemPrompt: `${RUBRIC}\n\n${INVESTIGATION_PROCEDURE}`,
        tools: ["Read", "Grep", "Glob"],
        allowedTools: ["Read", "Grep", "Glob"],
        outputFormat: { type: "json_schema", schema: VERDICT_JSON_SCHEMA },
        maxTurns: 60,
        maxBudgetUsd: 5,
      },
    };
  },
};
