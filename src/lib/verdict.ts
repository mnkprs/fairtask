import { z } from "zod";
import type { Verdict } from "./types.ts";

const Score = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export const EvidenceSchema = z.object({
  axis: z.enum(["underspecified", "false_negative"]).describe("Which score this evidence supports."),
  claim: z.string().describe("One factual claim that supports a score."),
  source: z.enum(["issue", "gold_patch", "test_patch", "repo"]),
  ref: z.string().describe('Where to look: for "repo" a path with lines like "astropy/io/ascii/core.py:L120-L134"; for patches the file name; for the issue, "issue".'),
  quote: z.string().describe("A short verbatim excerpt (<= 300 chars) from that location."),
});

export const VerdictSchema = z.object({
  underspecified: Score.describe("0 well-specified, 1 some blanks but a sensible interpretation, 2 vague/ambiguous, 3 almost impossible to understand"),
  underspecified_rationale: z.string().describe("Why, referencing specific files, functions or lines where relevant (>= 100 chars)."),
  false_negative: Score.describe("0 tests cover all reasonable solutions, 1 unusual solutions may be missed, 2 some perfectly reasonable solutions would fail, 3 tests are too narrow/broad or test something else"),
  false_negative_rationale: z.string().describe("Why, naming the specific test assertions, names or messages that constrain solutions (>= 100 chars)."),
  evidence: z.array(EvidenceSchema).describe("Evidence backing the two scores. Every score >= 2 must be backed by at least one item."),
  decision: z.enum(["usable", "flag"]).describe('"usable" if both scores are <= 1, else "flag".'),
  confidence: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
});

/** JSON schema handed to the SDK's `outputFormat` so the model's final answer is validated. */
export const VERDICT_JSON_SCHEMA = (() => {
  const { $schema: _draft, ...schema } = z.toJSONSchema(VerdictSchema) as Record<string, unknown>;
  return schema; // Claude Code validates with draft-07; the 2020-12 `$schema` header is rejected
})();

export function parseVerdict(x: unknown): Verdict {
  return VerdictSchema.parse(x) as Verdict;
}

/** Try hard to recover a verdict from free text (used when structured output is unavailable). */
export function extractVerdict(text: string): Verdict | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fence?.[1], text, text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const c of candidates) {
    if (!c) continue;
    try { return parseVerdict(JSON.parse(c)); } catch { /* next */ }
  }
  return null;
}
