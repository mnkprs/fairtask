/**
 * Emit the README tables from results/<run>/summary.json (run `npm run score -- <runs...>` first).
 *
 * Usage: node src/report.ts --baseline baseline --final v3-verify [--final-repeat <run>] [--runs baseline,v1-context,...] [--markdown]
 *
 * Prints aligned terminal tables by default; --markdown prints the pipe tables the README embeds.
 */
import { existsSync, readFileSync } from "node:fs";
import { resultsDir } from "./lib/paths.ts";
import type { Summary } from "./score.ts";
import { auditRun } from "./lib/audit.ts";
import { renderTable, renderTitle, type TableFormat } from "./lib/table.ts";

const args = new Map<string, string>();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) { const a = argv[i]!; if (!a.startsWith("--")) continue; const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) args.set(a.slice(2), "true"); else { args.set(a.slice(2), n); i++; } }
const load = (id: string): Summary => { const p = `${resultsDir(id)}/summary.json`; if (!existsSync(p)) throw new Error(`missing ${p} — run npm run score -- ${id}`); return JSON.parse(readFileSync(p, "utf8")); };

const pct = (x: number) => `${Math.round(100 * x)}%`;
const usd = (x: number) => `$${x.toFixed(2)}`;
const delta = (a: number, b: number, fmt: (x: number) => string, betterHigh = true) => { const d = Math.abs(b - a) < 0.005 ? 0 : b - a; const sign = d > 0 ? "+" : ""; const good = betterHigh ? d > 0 : d < 0; return `${sign}${fmt(d)}${d === 0 ? "" : good ? " ▲" : " ▼"}`; };

const base = load(args.get("baseline") ?? "baseline");
const fin = load(args.get("final") ?? "v3-verify");
const rep = args.get("final-repeat") ? load(args.get("final-repeat")!) : undefined;
if (rep) {
  const mismatch: string[] = [];
  if (rep.variant !== fin.variant) mismatch.push(`variant "${rep.variant}" vs "${fin.variant}"`);
  if (rep.model !== fin.model) mismatch.push(`model "${rep.model}" vs "${fin.model}"`);
  if (rep.n !== fin.n || rep.n_flag !== fin.n_flag || rep.n_usable !== fin.n_usable) mismatch.push(`case universe ${rep.n} (${rep.n_flag}/${rep.n_usable}) vs ${fin.n} (${fin.n_flag}/${fin.n_usable})`);
  if (mismatch.length) throw new Error(`--final-repeat ${rep.run_id} is not a repeat of ${fin.run_id}: ${mismatch.join("; ")}. A repeat must be the same configuration on the same cases run again.`);
}
const format: TableFormat = args.get("markdown") ? "markdown" : "table";
/** Show "first / repeat" when a repeat run of the final configuration exists. */
const both = (f: (s: Summary) => string) => (rep ? `${f(fin)} · ${f(rep)}` : f(fin));
const HUMAN_MIN_PER_TASK = 90; // assumption, see README
const badRate = (id: string) => { const a = auditRun(id); return `${Math.round(100 * a.bad_items / (a.items || 1))}% (${a.bad_items}/${a.items})`; };

const mean = (f: (s: Summary) => number) => (rep ? (f(fin) + f(rep)) / 2 : f(fin));
const headline: string[][] = [
  [`**Primary: decision accuracy vs. human annotators**`, `${pct(base.decision_accuracy)}`, `${both((s) => pct(s.decision_accuracy))}`, `${delta(base.decision_accuracy, mean((s) => s.decision_accuracy), (x) => `${Math.round(100 * x)} pts`)}${rep ? " (mean of 2 runs)" : ""}`],
  [`Flag recall (human-flagged tasks caught)`, `${pct(base.flag_recall)}`, `${both((s) => pct(s.flag_recall))}`, `${delta(base.flag_recall, mean((s) => s.flag_recall), (x) => `${Math.round(100 * x)} pts`)}`],
  [`TPR / TNR (flagged caught / clean left alone; scored cases only)`, `${pct(base.tpr)} (${Math.round(base.tpr * base.n_flag)}/${base.n_flag}) / ${pct(base.tnr)} (${Math.round(base.tnr * base.n_usable)}/${base.n_usable})`, `${both((s) => `${pct(s.tpr)} (${Math.round(s.tpr * s.n_flag)}/${s.n_flag}) / ${pct(s.tnr)} (${Math.round(s.tnr * s.n_usable)}/${s.n_usable})`)}`, `—`],
  [`Missed problems / false alarms`, `${base.missed_problems} / ${base.false_alarms}`, `${both((s) => `${s.missed_problems} / ${s.false_alarms}`)}`, `—`],
  [`Cohen's κ vs. humans`, `${base.kappa.toFixed(2)}`, `${both((s) => s.kappa.toFixed(2))}`, `${delta(base.kappa, mean((s) => s.kappa), (x) => x.toFixed(2))}`],
  [`Both axes flagged correctly`, `${pct(base.both_axes_correct)}`, `${both((s) => pct(s.both_axes_correct))}`, `${delta(base.both_axes_correct, mean((s) => s.both_axes_correct), (x) => `${Math.round(100 * x)} pts`)}`],
  [`Cited evidence that fails verification (item rate)`, `${badRate(base.run_id)}`, `${both((s) => badRate(s.run_id))}`, `—`],
  [`Human time per task (assumption: ${HUMAN_MIN_PER_TASK} min of expert review today)`, `${HUMAN_MIN_PER_TASK} min`, `reviewer checks cited evidence only`, `—`],
  [`Machine wall-clock per task`, `${Math.round(base.mean_duration_s)} s`, `${Math.round(fin.mean_duration_s)} s`, `${delta(base.mean_duration_s, fin.mean_duration_s, (x) => `${Math.round(x)} s`, false)}`],
  [`Cost per task (USD, list price)`, `${usd(base.mean_cost_usd)}`, `${usd(fin.mean_cost_usd)}`, `${delta(base.mean_cost_usd, fin.mean_cost_usd, usd, false)}`],
  [`Challenging case (\`${fin.challenging?.instance_id}\`)`, `${base.challenging?.correct ? "correct" : "wrong"} (${base.challenging?.pred})`, `${fin.challenging?.correct ? "correct" : "wrong"} (${fin.challenging?.pred})`, `human: ${fin.challenging?.human}`],
];
console.log(renderTitle(`Headline comparison (${base.n} cases, development set — same cases and same deciding model for both${rep ? "; final shown as first run · repeat run" : ""})`, format));
console.log(renderTable(["Metric", `Simple baseline (\`${base.run_id}\`)`, `Agent solution (\`${fin.run_id}\`)`, "Change"], headline, format));

const runs = (args.get("runs") ?? "").split(",").filter(Boolean).map(load);
if (runs.length) {
  console.log("\n" + renderTitle(`All systems on the same ${base.n} cases (development set)`, format));
  console.log(renderTable(
    ["Run", "Decision acc.", "κ", "TPR / TNR", "Missed / false alarms", "Both axes", "Bad evidence", "Cost/task", "Time/task"],
    runs.map((r) => [`\`${r.run_id}\``, pct(r.decision_accuracy), r.kappa.toFixed(2), `${pct(r.tpr)} / ${pct(r.tnr)}`, `${r.missed_problems} / ${r.false_alarms}`, pct(r.both_axes_correct), badRate(r.run_id), usd(r.mean_cost_usd), `${Math.round(r.mean_duration_s)} s`]),
    format,
  ));
}
