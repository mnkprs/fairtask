/** A candidate task as a screener receives it: no labels. This is the input to `npm run screen`. */
export interface TaskInstance {
  instance_id: string;
  repo: string; // "owner/name" or a full GitHub URL
  base_commit: string;
  version?: string;
  created_at?: string;
  problem_statement: string;
  hints_text?: string;
  /** Gold patch from the original PR (code changes). */
  patch: string;
  /** Test patch from the original PR (test changes). */
  test_patch: string;
  FAIL_TO_PASS: string[];
  PASS_TO_PASS?: string[];
}

/** One SWE-bench task instance joined with OpenAI's human annotation (the evaluation set). */
export interface EvalInstance extends TaskInstance {
  version: string;
  created_at: string;
  hints_text: string;
  PASS_TO_PASS: string[];
  /** Human ground truth (ensembled across 3 annotators, max-severity). */
  human: HumanAnnotation;
  /** Which stratum this instance was sampled from. */
  stratum: Stratum;
  /** Marked as the designated "challenging case" in the report. */
  challenging?: boolean;
}

export type Stratum = "clean" | "underspecified" | "unfair_tests" | "both";

export interface HumanAnnotation {
  underspecified: 0 | 1 | 2 | 3;
  underspecified_notes: string;
  false_negative: 0 | 1 | 2 | 3;
  false_negative_notes: string;
  other_major_issues: 0 | 1;
  other_notes: string;
  difficulty: string;
  /** OpenAI's filter decision (true = excluded from SWE-bench Verified). */
  filter_out: boolean;
}

/** The structured verdict every system (baseline and agent variants) must emit. */
export interface Verdict {
  underspecified: 0 | 1 | 2 | 3;
  underspecified_rationale: string;
  false_negative: 0 | 1 | 2 | 3;
  false_negative_rationale: string;
  evidence: Evidence[];
  decision: "usable" | "flag";
  confidence: 1 | 2 | 3 | 4 | 5;
}

export interface Evidence {
  axis: "underspecified" | "false_negative";
  claim: string;
  source: "issue" | "gold_patch" | "test_patch" | "repo";
  /** For repo: "path/to/file.py:L120-L134". For patches: the hunk header or quoted line. */
  ref: string;
  quote: string;
}

/** One prediction record written to results/<run>/predictions.jsonl */
export interface Prediction {
  run_id: string;
  variant: string;
  instance_id: string;
  verdict: Verdict | null;
  error?: string;
  /** Result of the variant's own validator on the final verdict (undefined for variants without one). */
  verified?: boolean;
  cost_usd: number;
  duration_ms: number;
  num_turns: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  retries: number;
  session_id?: string;
}
