/**
 * Screen one candidate task with fairtask and print a reviewable verdict.
 *
 *   npm run screen -- --task path/to/task.json          # your own task (see README "Use it on your own tasks")
 *   npm run screen -- --swebench django__django-11099   # any instance of a SWE-bench-style dataset on Hugging Face
 *        [--dataset princeton-nlp/SWE-bench] [--variant v3-verify] [--model claude-opus-5] [--out screenings]
 *
 * Output: screenings/<instance_id>/verdict.json (+ the full trajectory next to it) and a summary on stdout.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { TaskInstance } from "./lib/types.ts";
import { VARIANTS } from "./variants/index.ts";
import { runOne } from "./lib/run.ts";
import { prepareWorkspace } from "./lib/workspace.ts";
import { ROOT, assertSlug, trajectoryPath } from "./lib/paths.ts";
import { resolve, sep } from "node:path";

const args = new Map<string, string>();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) { const a = argv[i]!; if (!a.startsWith("--")) continue; const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) args.set(a.slice(2), "true"); else { args.set(a.slice(2), n); i++; } }
const usage = () => { console.error("usage: npm run screen -- (--task task.json | --swebench <instance_id> [--dataset princeton-nlp/SWE-bench]) [--variant v3-verify] [--model claude-opus-5] [--out screenings]"); process.exit(2); };

async function fromHuggingFace(instanceId: string, dataset: string): Promise<TaskInstance> {
  const url = `https://datasets-server.huggingface.co/filter?dataset=${encodeURIComponent(dataset)}&config=default&split=test&where=${encodeURIComponent(`"instance_id"='${instanceId}'`)}&length=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hugging Face datasets-server returned ${res.status} for ${dataset}`);
  const row = ((await res.json()) as { rows: Array<{ row: Record<string, unknown> }> }).rows[0]?.row;
  if (!row) throw new Error(`instance "${instanceId}" not found in ${dataset} (test split)`);
  const list = (v: unknown) => (Array.isArray(v) ? (v as string[]) : typeof v === "string" ? (JSON.parse(v) as string[]) : []);
  return { instance_id: assertSlug("instance_id", String(row.instance_id)), repo: String(row.repo), base_commit: String(row.base_commit), version: row.version == null ? undefined : String(row.version), problem_statement: String(row.problem_statement), hints_text: String(row.hints_text ?? ""), patch: String(row.patch), test_patch: String(row.test_patch), FAIL_TO_PASS: list(row.FAIL_TO_PASS), PASS_TO_PASS: list(row.PASS_TO_PASS) };
}

function fromFile(path: string): TaskInstance {
  const t = JSON.parse(readFileSync(path, "utf8")) as Partial<TaskInstance>;
  for (const k of ["repo", "base_commit", "problem_statement", "patch", "test_patch"] as const) if (!t[k]) { console.error(`task file is missing "${k}"`); process.exit(2); }
  const derivedId = `${String(t.repo).replace(/^.*github\.com\//, "").replace(/[^A-Za-z0-9_-]+/g, "__")}-${String(t.base_commit).slice(0, 8)}`;
  return { ...(t as TaskInstance), instance_id: assertSlug("instance_id", t.instance_id ?? derivedId), FAIL_TO_PASS: t.FAIL_TO_PASS ?? [] };
}

const variantName = args.get("variant") ?? "v3-verify";
const variant = VARIANTS[variantName];
if (!variant) { console.error(`unknown variant "${variantName}"; one of: ${Object.keys(VARIANTS).join(", ")}`); process.exit(2); }
const task = args.has("task") ? fromFile(args.get("task")!) : args.has("swebench") ? await fromHuggingFace(args.get("swebench")!, args.get("dataset") ?? "princeton-nlp/SWE-bench") : (usage(), undefined as never);
const outRoot = resolve(args.get("out") ?? `${ROOT}screenings`);
const outDir = resolve(outRoot, task.instance_id);
if (!outDir.startsWith(outRoot + sep)) throw new Error("output directory escapes --out");
mkdirSync(outDir, { recursive: true });

console.log(`fairtask · ${task.instance_id} · ${variantName} · ${args.get("model") ?? "claude-opus-5"}`);
const ws = await prepareWorkspace(task);
console.log(`repository ${task.repo} @ ${task.base_commit.slice(0, 10)} (${ws.status}) → ${ws.dir}`);
if (task.FAIL_TO_PASS.length === 0) console.log("note: no FAIL_TO_PASS list given — the probes will treat every test in the test patch as graded");

// Every screening gets its own attempt id, so concurrent screenings of the same instance never share a trajectory file.
const attempt = `${Date.now().toString(36)}-${process.pid}`;
const runId = `screen-${task.instance_id}-${attempt}`;
const p = await runOne(variant, task, { runId, model: args.get("model") ?? "claude-opus-5" });
const traj = trajectoryPath(runId, task.instance_id);
const record = { ...p, task: { instance_id: task.instance_id, repo: task.repo, base_commit: task.base_commit }, attempt, trajectory: traj, screened_at: new Date().toISOString() };
// Verdict and trajectory are published together via temporary files + rename, so a reader never sees a torn pair.
const atomicWrite = (path: string, data: string | Buffer) => { const tmp = `${path}.${attempt}.tmp`; writeFileSync(tmp, data); renameSync(tmp, path); };
atomicWrite(`${outDir}/verdict.json`, JSON.stringify(record, null, 2));
if (existsSync(traj)) atomicWrite(`${outDir}/trajectory.jsonl`, readFileSync(traj));

const v = p.verdict;
console.log("\n" + "─".repeat(72));
if (!v) { console.log(`NO VERDICT: ${p.error}`); process.exit(1); }
const flag = v.underspecified >= 2 || v.false_negative >= 2;
console.log(`${flag ? "FLAG" : "USABLE"}   underspecified=${v.underspecified}  false_negative=${v.false_negative}  confidence=${v.confidence}/5  ${p.verified === false ? "(evidence NOT verified)" : p.verified ? "(evidence verified)" : ""}`);
console.log(`\nIssue specification (${v.underspecified}): ${v.underspecified_rationale}`);
console.log(`\nTest scope (${v.false_negative}): ${v.false_negative_rationale}`);
console.log(`\nEvidence (${v.evidence.length}):`);
for (const e of v.evidence) console.log(`  [${e.axis}] ${e.source}${e.ref && e.ref !== "issue" ? ` ${e.ref}` : ""}\n     ${e.claim}\n     › ${e.quote.replace(/\s+/g, " ").slice(0, 160)}`);
console.log(`\n$${p.cost_usd.toFixed(2)} · ${(p.duration_ms / 1000).toFixed(0)}s · ${p.num_turns} turns${p.retries ? ` · ${p.retries} verification retr${p.retries === 1 ? "y" : "ies"}` : ""}`);
console.log(`written: ${outDir}/verdict.json  (trajectory: ${outDir}/trajectory.jsonl; render with npm run trajectory -- ${traj})`);
