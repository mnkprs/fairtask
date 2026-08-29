import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { EvalInstance, Prediction } from "./types.ts";
import { ROOT, resultsDir, workspaceDir } from "./paths.ts";
import { verifyVerdict } from "./verify.ts";

export interface Audit { run_id: string; verdicts: number; items: number; bad_items: number; verdicts_with_bad: number; unbacked_scores: number }

let instances: Map<string, EvalInstance> | undefined;
const byId = () => (instances ??= new Map((JSON.parse(readFileSync(`${ROOT}data/eval/instances.json`, "utf8")) as EvalInstance[]).map((i) => [i.instance_id, i])));

/** Run the deterministic verifier over every verdict of a run (post hoc) and count what does not check out. */
/**
 * The audit certifies that quotes exist at the base commit, so every workspace must exist, be checked out at exactly
 * that commit, and be unmodified. Anything else fails closed rather than producing a wrong number.
 */
export function requireWorkspaces(ids: Iterable<string>): void {
  const problems: string[] = [];
  for (const id of ids) {
    const inst = byId().get(id);
    const dir = workspaceDir(id);
    if (!inst) { problems.push(`${id}: not in the evaluation set`); continue; }
    if (!existsSync(`${dir}/.git`)) { problems.push(`${id}: not cloned`); continue; }
    const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf8" }).trim();
    try {
      const head = git("rev-parse", "HEAD");
      if (head !== inst.base_commit) { problems.push(`${id}: HEAD ${head.slice(0, 10)} is not base_commit ${inst.base_commit.slice(0, 10)}`); continue; }
      if (git("status", "--porcelain", "--untracked-files=all") !== "") problems.push(`${id}: working tree has modified or untracked files`);
    } catch (e) { problems.push(`${id}: ${(e as Error).message.split("\n")[0]}`); }
  }
  if (problems.length) throw new Error(`${problems.length} workspace(s) cannot be used for verification:\n  ${problems.slice(0, 5).join("\n  ")}${problems.length > 5 ? "\n  …" : ""}\nRun \`npm run data:workspaces\` to (re)clone them at the base commit.`);
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
