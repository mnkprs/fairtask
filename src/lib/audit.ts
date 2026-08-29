import { existsSync, readFileSync } from "node:fs";
import type { EvalInstance, Prediction } from "./types.ts";
import { ROOT, resultsDir, workspaceDir } from "./paths.ts";
import { verifyVerdict } from "./verify.ts";

export interface Audit { run_id: string; verdicts: number; items: number; bad_items: number; verdicts_with_bad: number; unbacked_scores: number }

let instances: Map<string, EvalInstance> | undefined;
const byId = () => (instances ??= new Map((JSON.parse(readFileSync(`${ROOT}data/eval/instances.json`, "utf8")) as EvalInstance[]).map((i) => [i.instance_id, i])));

/** Run the deterministic verifier over every verdict of a run (post hoc) and count what does not check out. */
/** The audit reads files at the base commit, so every workspace must exist — otherwise the numbers would be wrong, not missing. */
export function requireWorkspaces(ids: Iterable<string>): void {
  const missing = [...ids].filter((id) => !existsSync(`${workspaceDir(id)}/.git`));
  if (missing.length) throw new Error(`${missing.length} workspace(s) are not cloned (e.g. ${missing[0]}). Run \`npm run data:workspaces\` first — repo-sourced evidence cannot be checked without the repository at the base commit.`);
}

export function auditRun(runId: string): Audit {
  const preds = readFileSync(`${resultsDir(runId)}/predictions.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Prediction);
  requireWorkspaces(preds.filter((p) => p.verdict && byId().has(p.instance_id)).map((p) => p.instance_id));
  const a: Audit = { run_id: runId, verdicts: 0, items: 0, bad_items: 0, verdicts_with_bad: 0, unbacked_scores: 0 };
  for (const p of preds) {
    const inst = byId().get(p.instance_id);
    if (!p.verdict || !inst) continue;
    a.verdicts++; a.items += p.verdict.evidence.length;
    const problems = verifyVerdict(p.verdict, inst, workspaceDir(inst.instance_id));
    const bad = problems.filter((x) => x.startsWith("evidence[")).length;
    a.bad_items += bad; if (bad) a.verdicts_with_bad++;
    a.unbacked_scores += problems.filter((x) => x.includes("has no verified evidence")).length;
  }
  return a;
}
