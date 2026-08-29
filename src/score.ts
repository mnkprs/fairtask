/**
 * Score one or more runs against the human annotations and print a comparison table.
 *
 * Usage: node src/score.ts <run-id> [<run-id> ...] [--detail] [--json]
 * Writes results/<run-id>/summary.json for each run.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { EvalInstance, Prediction, Stratum } from "./lib/types.ts";
import { ROOT, resultsDir } from "./lib/paths.ts";

const argv = process.argv.slice(2);
const detail = argv.includes("--detail");
const asJson = argv.includes("--json");
const common = argv.includes("--common"); // restrict every run to the instances that ALL listed runs scored
const runIds = argv.filter((a) => !a.startsWith("--"));
if (runIds.length === 0) { console.error("usage: node src/score.ts <run-id> [...] [--detail] [--json]"); process.exit(2); }

const instances = JSON.parse(readFileSync(`${ROOT}data/eval/instances.json`, "utf8")) as EvalInstance[];
const byId = new Map(instances.map((i) => [i.instance_id, i]));
const usable = (us: number, fn: number) => us <= 1 && fn <= 1;
/** The decision is derived from the two scores, never taken from the model's own `decision` field. */
const predFlag = (v: NonNullable<Prediction["verdict"]>) => !usable(v.underspecified, v.false_negative);

export interface Summary {
  run_id: string; variant: string; model: string;
  /** n = size of the evaluation universe (every expected instance); scored = instances with a verdict; errors = expected but errored or missing. */
  n: number; scored: number; errors: number; unverified: number;
  decision_accuracy: number; balanced_accuracy: number; flag_precision: number; flag_recall: number; flag_f1: number; kappa: number;
  /** TPR = share of human-flagged tasks flagged; TNR = share of human-usable tasks left usable (scored instances only). */
  tpr: number; tnr: number; n_flag: number; n_usable: number;
  missed_problems: number; false_alarms: number; both_axes_correct: number;
  underspecified: AxisStats; false_negative: AxisStats;
  per_stratum: Record<Stratum, { n: number; correct: number }>;
  mean_cost_usd: number; total_cost_usd: number; mean_duration_s: number; mean_turns: number; mean_retries: number;
  challenging: { instance_id: string; correct: boolean; pred?: string; human: string } | null;
}
interface AxisStats { exact: number; within1: number; mae: number; flag_agreement: number; missed: number; false_alarm: number }

function axis(preds: Array<{ h: number; p: number }>): AxisStats {
  const n = preds.length || 1;
  return {
    exact: preds.filter((x) => x.h === x.p).length / n,
    within1: preds.filter((x) => Math.abs(x.h - x.p) <= 1).length / n,
    mae: preds.reduce((a, x) => a + Math.abs(x.h - x.p), 0) / n,
    flag_agreement: preds.filter((x) => (x.h >= 2) === (x.p >= 2)).length / n,
    missed: preds.filter((x) => x.h >= 2 && x.p <= 1).length,
    false_alarm: preds.filter((x) => x.h <= 1 && x.p >= 2).length,
  };
}

function loadPreds(runId: string): Prediction[] {
  const path = `${resultsDir(runId)}/predictions.jsonl`;
  if (!existsSync(path)) throw new Error(`no predictions at ${path}`);
  const raw = readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Prediction);
  const byInst = new Map<string, Prediction>();
  for (const p of raw) byInst.set(p.instance_id, p); // one prediction per instance (last wins)
  if (byInst.size < raw.length) console.warn(`${runId}: ${raw.length - byInst.size} duplicate prediction row(s) ignored`);
  return [...byInst.values()];
}
/** Cost of errored attempts that were later retried (kept in an append-only ledger by --retry-errors). */
function erroredAttemptCost(runId: string): number {
  const path = `${resultsDir(runId)}/attempts-errored.jsonl`;
  if (!existsSync(path)) return 0;
  return readFileSync(path, "utf8").split("\n").filter(Boolean).reduce((a, l) => a + ((JSON.parse(l) as Prediction).cost_usd || 0), 0);
}
const commonIds: Set<string> | null = common
  ? runIds.map((id) => new Set(loadPreds(id).filter((p) => p.verdict).map((p) => p.instance_id))).reduce((a, b) => new Set([...a].filter((x) => b.has(x))))
  : null;

function summarize(runId: string): Summary {
  const dir = resultsDir(runId);
  const path = `${dir}/predictions.jsonl`;
  if (!existsSync(path)) throw new Error(`no predictions at ${path}`);
  const run = existsSync(`${dir}/run.json`) ? JSON.parse(readFileSync(`${dir}/run.json`, "utf8")) : {};
  const preds = loadPreds(runId);
  const predById = new Map(preds.map((p) => [p.instance_id, p]));
  // The universe is the evaluation set itself, so a missing instance counts as an error instead of disappearing.
  const universe = instances.filter((i) => !commonIds || commonIds.has(i.instance_id));
  const rows = universe.map((i) => ({ i, p: predById.get(i.instance_id) }));
  const scored = rows.filter((r): r is { i: EvalInstance; p: Prediction } => !!r.p?.verdict);
  let tp = 0, fp = 0, fn = 0, tn = 0, wrong = 0;
  const per: Record<Stratum, { n: number; correct: number }> = { clean: { n: 0, correct: 0 }, underspecified: { n: 0, correct: 0 }, unfair_tests: { n: 0, correct: 0 }, both: { n: 0, correct: 0 } };
  let challenging: Summary["challenging"] = null;
  let bothAxes = 0;
  for (const { p, i } of rows) {
    const v = p?.verdict ?? null;
    if (v && (i.human.underspecified >= 2) === (v.underspecified >= 2) && (i.human.false_negative >= 2) === (v.false_negative >= 2)) bothAxes++;
    const hFlag = !usable(i.human.underspecified, i.human.false_negative);
    const correct = v ? predFlag(v) === hFlag : false; // an errored/missing instance is simply wrong for accuracy
    per[i.stratum].n++; if (correct) per[i.stratum].correct++;
    if (v) { const pFlag = predFlag(v); if (hFlag && pFlag) tp++; else if (!hFlag && pFlag) fp++; else if (hFlag && !pFlag) fn++; else tn++; }
    else wrong++;
    if (i.challenging) challenging = { instance_id: i.instance_id, correct, pred: v ? `us=${v.underspecified} fn=${v.false_negative} ${predFlag(v) ? "flag" : "usable"}` : "ERROR", human: `us=${i.human.underspecified} fn=${i.human.false_negative} ${hFlag ? "flag" : "usable"}` };
  }
  const n = rows.length || 1;          // accuracy is over the whole universe (errors count as wrong)
  const m = scored.length || 1;        // agreement statistics are over scored instances only (errors are coverage, not pseudo-labels)
  const acc = (tp + tn) / n;
  const tpr = tp / ((tp + fn) || 1), tnr = tn / ((tn + fp) || 1);
  const prec = tp / ((tp + fp) || 1), rec = tpr;
  const f1 = (2 * prec * rec) / ((prec + rec) || 1);
  const pe = (((tp + fp) * (tp + fn)) + ((fn + tn) * (fp + tn))) / (m * m);
  const po = (tp + tn) / m;
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  const s = (sel: (x: Prediction) => number) => scored.reduce((a, r) => a + sel(r.p), 0) / (scored.length || 1);
  const attempts = preds.filter((p) => !commonIds || commonIds.has(p.instance_id));
  return {
    run_id: runId, variant: run.variant ?? preds[0]?.variant ?? "?", model: run.model ?? "?", n: rows.length, scored: scored.length, errors: rows.length - scored.length,
    unverified: scored.filter((r) => r.p.verified === false).length,
    decision_accuracy: acc, balanced_accuracy: (tpr + tnr) / 2, flag_precision: prec, flag_recall: rec, flag_f1: f1, kappa,
    tpr, tnr, n_flag: tp + fn, n_usable: tn + fp,
    missed_problems: fn, false_alarms: fp, both_axes_correct: bothAxes / n,
    underspecified: axis(scored.map((r) => ({ h: r.i.human.underspecified, p: r.p.verdict!.underspecified }))),
    false_negative: axis(scored.map((r) => ({ h: r.i.human.false_negative, p: r.p.verdict!.false_negative }))),
    per_stratum: per,
    mean_cost_usd: attempts.reduce((a, p) => a + p.cost_usd, 0) / (attempts.length || 1), total_cost_usd: attempts.reduce((a, p) => a + p.cost_usd, 0) + (commonIds ? 0 : erroredAttemptCost(runId)), mean_duration_s: s((p) => p.duration_ms / 1000), mean_turns: s((p) => p.num_turns), mean_retries: s((p) => p.retries),
    challenging,
  };
}

const summaries = runIds.map((id) => { const s = summarize(id); if (!common) writeFileSync(`${resultsDir(id)}/summary.json`, JSON.stringify(s, null, 2)); return s; });
if (commonIds) console.log(`(restricted to the ${commonIds.size}/${instances.length} instances scored by every listed run; per-run coverage: ${runIds.map((id) => `${id}=${loadPreds(id).filter((p) => p.verdict).length}`).join(", ")})\n`);
if (asJson) { console.log(JSON.stringify(summaries, null, 2)); process.exit(0); }

const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
const col = (s: string, w = 14) => s.padStart(w);
const line = (label: string, f: (s: Summary) => string) => console.log(`${label.padEnd(34)}${summaries.map((s) => col(f(s))).join("")}`);
console.log(`${"".padEnd(34)}${summaries.map((s) => col(s.run_id.slice(0, 13))).join("")}`);
console.log("-".repeat(34 + 14 * summaries.length));
line("instances scored / expected", (s) => `${s.scored}/${s.n}${s.errors ? ` (${s.errors} err)` : ""}`);
line("verdicts failing verification", (s) => String(s.unverified));
line("PRIMARY decision accuracy", (s) => pct(s.decision_accuracy));
line("balanced accuracy", (s) => pct(s.balanced_accuracy));
line("Cohen's kappa vs humans", (s) => s.kappa.toFixed(2));
line("flag precision / recall", (s) => `${pct(s.flag_precision)}/${pct(s.flag_recall)}`);
line("TPR / TNR (scored only)", (s) => `${pct(s.tpr)} (${Math.round(s.tpr * s.n_flag)}/${s.n_flag}) / ${pct(s.tnr)} (${Math.round(s.tnr * s.n_usable)}/${s.n_usable})`);
line("missed problems (human flag)", (s) => String(s.missed_problems));
line("false alarms (human usable)", (s) => String(s.false_alarms));
line("both axes flagged correctly", (s) => pct(s.both_axes_correct));
line("underspecified: exact / ±1", (s) => `${pct(s.underspecified.exact)}/${pct(s.underspecified.within1)}`);
line("underspecified: MAE", (s) => s.underspecified.mae.toFixed(2));
line("false_negative: exact / ±1", (s) => `${pct(s.false_negative.exact)}/${pct(s.false_negative.within1)}`);
line("false_negative: MAE", (s) => s.false_negative.mae.toFixed(2));
for (const st of ["clean", "underspecified", "unfair_tests", "both"] as Stratum[]) line(`  stratum ${st}`, (s) => `${s.per_stratum[st].correct}/${s.per_stratum[st].n}`);
line("challenging case correct?", (s) => (s.challenging ? (s.challenging.correct ? "yes" : "no") : "-"));
line("mean cost / task (USD list)", (s) => `$${s.mean_cost_usd.toFixed(3)}`);
line("total cost (USD list)", (s) => `$${s.total_cost_usd.toFixed(2)}`);
line("mean wall time / task", (s) => `${s.mean_duration_s.toFixed(0)}s`);
line("mean turns / task", (s) => s.mean_turns.toFixed(1));
line("mean verification retries", (s) => s.mean_retries.toFixed(2));

if (detail) {
  for (const id of runIds) {
    console.log(`\n== ${id} per instance ==`);
    const preds = readFileSync(`${resultsDir(id)}/predictions.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Prediction);
    for (const p of preds.sort((a, b) => a.instance_id.localeCompare(b.instance_id))) {
      const i = byId.get(p.instance_id); if (!i) continue;
      const hFlag = !usable(i.human.underspecified, i.human.false_negative);
      const v = p.verdict;
      const ok = v ? predFlag(v) === hFlag : false;
      console.log(`${ok ? "ok " : "XX "}${p.instance_id.padEnd(36)} ${i.stratum.padEnd(14)} human us=${i.human.underspecified} fn=${i.human.false_negative} | pred ${v ? `us=${v.underspecified} fn=${v.false_negative} ${v.decision.padEnd(6)} conf=${v.confidence}` : `ERROR ${p.error}`} | $${p.cost_usd.toFixed(2)} ${(p.duration_ms / 1000).toFixed(0)}s${p.retries ? ` r=${p.retries}` : ""}`);
    }
  }
}
