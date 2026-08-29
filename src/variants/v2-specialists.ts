import type { AgentDefinition, HookCallback } from "@anthropic-ai/claude-agent-sdk";
import type { Variant } from "../lib/variant.ts";
import { RUBRIC } from "../lib/rubric.ts";
import { renderInstance } from "../lib/context.ts";
import { VERDICT_JSON_SCHEMA } from "../lib/verdict.ts";

const REPORT_FORMAT = `Report format (markdown):
- **Score:** <0-3> — one-sentence summary
- **Evidence:** bullet list; each bullet = a claim, then the location (repo path with line range like \`pkg/mod.py:L40-L52\`, or \`test_patch\` / \`gold_patch\` / \`issue\`), then a verbatim quote (<= 300 chars) from that location.
- **What would change my mind:** one or two sentences.
Quotes must be verbatim — they will be checked against the files. You may elide lines with "..." between verbatim fragments.`;

export const SPEC_PROBE: AgentDefinition = {
  description: "Assesses whether the issue text alone is well-specified enough for an engineer to attempt a fix without asking questions. Use for the underspecified axis.",
  tools: ["Read", "Grep", "Glob"],
  prompt: `You are the specification probe for a benchmark-task screening pipeline. You receive a GitHub issue, the gold
patch and test patch from the PR that fixed it, and read-only access to the repository at the pre-fix commit (cwd).

Your single question: **Is the issue text well-specified enough for a meaningful attempt at a solution?**
Imagine an experienced engineer with full codebase access who cannot ask for clarification and never sees the PR.

Scale:
- 0: well-specified; it is clear what is required for a successful solution.
- 1: some blanks to fill in, but there is a sensible interpretation of what is required.
- 2: vague / ambiguous; unclear what a successful solution would look like.
- 3: almost impossible to understand what is being asked without further information.

Method:
1. Grep/Read the code the issue points at. Establish what a solver would need to decide: expected behaviour, scope
   (one case or the general case), edge cases, interface (names, types, errors), and which of several plausible
   interpretations is wanted.
2. For each open decision, check whether the codebase resolves it for a careful reader (existing conventions,
   docstrings, sibling functions, the reproduction in the issue). Only decisions the codebase does NOT resolve count.
3. Compare with what the gold patch actually did: if the gold patch made a choice the issue never implied and a
   different choice would have been equally faithful to the issue, that is ambiguity (raise the score); but do not
   penalise the issue for implementation details it reasonably left to the engineer.
4. Decide the score. Be calibrated: most real issues score 0-1; reserve 2 for genuine ambiguity about WHAT to build,
   3 for issues that cannot be understood.

${REPORT_FORMAT}`,
};

export const TEST_PROBE: AgentDefinition = {
  description: "Assesses whether the hidden tests would accept all reasonable solutions to the issue, or only the gold patch's particular choices. Use for the false_negative axis.",
  tools: ["Read", "Grep", "Glob"],
  prompt: `You are the test-scope probe for a benchmark-task screening pipeline. You receive a GitHub issue, the gold patch
and test patch from the PR that fixed it, and read-only access to the repository at the pre-fix commit (cwd).

Your single question: **Would ALL reasonable solutions to the issue pass these tests, or do the tests depend on
choices that only the gold patch made?** The solver sees only the issue and the repo — never the PR or the tests.

Scale:
- 0: the tests perfectly cover all possible solutions.
- 1: the tests cover the majority of correct solutions; some unusual solutions may be missed.
- 2: the tests work, but some perfectly reasonable solutions would be missed.
- 3: the tests are too narrow/broad, or test something different from what the issue is about.

Method:
1. Read the test patch against the actual test files in the repo (Read the file, find where the hunk lands, understand
   the fixtures and helpers it relies on).
2. For EVERY new or changed assertion, extract what it pins down: function/parameter/attribute names, argument order,
   return values and types, exception classes, exact message wording, output formatting, warning categories, call
   counts. For each, answer: is this stated (or unambiguously implied) by the issue text? Or does it exist only because
   the gold patch chose it? Check the repo for existing conventions that would make the gold patch's choice the only
   natural one (Grep for sibling APIs with the same naming pattern) — a convention-following name is not a discrepancy.
3. Write down at least two concrete alternative fixes a competent engineer could produce from the issue alone (e.g.
   a different parameter name, a different error type, fixing at a different layer, handling only the reported case,
   returning a different but equally valid value). For each, trace whether the FAIL_TO_PASS tests would pass.
4. Also check the other direction: do the tests actually test what the issue is about, or something adjacent?
5. Decide the score. A single test-pinned name/message the issue never mentions is typically a 2 (a reasonable
   alternative fails); tests that require a different feature than the issue describes are a 3.

${REPORT_FORMAT}`,
};

export const JUDGE_PROMPT = `${RUBRIC}

## Your role: judge
You do not investigate everything yourself. You dispatch two specialist probes, then decide.
1. Call the **spec-probe** and the **test-probe** subagents (both, in parallel, in the same turn). Pass each the full
   candidate task material verbatim (issue, gold patch, test patch, FAIL_TO_PASS) — they do not see your context.
2. Read both reports. For each probe, spot-check its strongest claim with your own Read/Grep before accepting it:
   open the cited location and confirm the quote is real and the interpretation holds.
3. Produce the verdict. Scores follow the probes unless your spot-check contradicts them; carry the probes' evidence
   items (location + verbatim quote) into the \`evidence\` array. Every score >= 2 must have supporting evidence.
4. Decision is "usable" only if both scores are <= 1.`;

const ALLOWED_SUBAGENTS = new Set(["spec-probe", "test-probe"]);
/** Only the two declared probes may be dispatched — not Claude Code's built-in subagents. */
export const onlyDeclaredProbes: HookCallback = async (input) => {
  if (input.hook_event_name !== "PreToolUse") return {};
  const sub = (input.tool_input as { subagent_type?: string }).subagent_type ?? "";
  if (ALLOWED_SUBAGENTS.has(sub)) return {};
  return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `Subagent "${sub}" is not part of this pipeline. Use spec-probe and test-probe.` } };
};

/**
 * Iteration 2 — orchestration: two specialist probes, each owning one axis, plus a judge that spot-checks their
 * evidence before deciding.
 */
export const v2Specialists: Variant = {
  name: "v2-specialists",
  description: "Judge agent orchestrating two specialist subagents (spec-probe, test-probe) with spot-check verification.",
  build(inst, ctx) {
    return {
      prompt: `${renderInstance(inst)}\nRun both probes on this candidate task, spot-check them, and return the verdict.`,
      options: {
        model: ctx.model,
        cwd: ctx.workspace,
        systemPrompt: JUDGE_PROMPT,
        tools: ["Agent", "Read", "Grep", "Glob"],
        allowedTools: ["Agent", "Read", "Grep", "Glob"],
        agents: { "spec-probe": { ...SPEC_PROBE, model: ctx.model }, "test-probe": { ...TEST_PROBE, model: ctx.model } },
        hooks: { PreToolUse: [{ matcher: "Agent", hooks: [onlyDeclaredProbes] }] },
        outputFormat: { type: "json_schema", schema: VERDICT_JSON_SCHEMA },
        maxTurns: 80,
        maxBudgetUsd: 8,
      },
    };
  },
};
