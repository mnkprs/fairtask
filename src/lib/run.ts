import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { query, type HookCallback, type Options, type SDKMessage, type SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { EvalInstance, Prediction, TaskInstance, Verdict } from "./types.ts";
import type { Variant, RunContext } from "./variant.ts";
import { extractVerdict, parseVerdict } from "./verdict.ts";
import { TrajectoryWriter } from "./trajectory.ts";
import { ROOT, resultsDir, trajectoryPath, workspaceDir } from "./paths.ts";
import { VERIFIER_VERSION } from "./verify.ts";
import { VERDICT_JSON_SCHEMA } from "./verdict.ts";

export interface RunOpts {
  runId: string;
  model: string;
  concurrency: number;
  force: boolean;
  /** Drop previously errored predictions so they are re-run. */
  retryErrors: boolean;
  instances: EvalInstance[];
}

/**
 * Filesystem guard: the built-in Read/Grep/Glob tools accept absolute paths, and `cwd` is not a sandbox. Deny any
 * path outside the instance's workspace so an agent (or prompt injection in repository content) cannot reach the
 * evaluation labels, other instances, results or trajectories.
 */
export function workspaceGuard(workspace: string): HookCallback {
  const root = realpathSync(resolve(workspace));
  /** Canonical path of the deepest existing ancestor, so symlinks inside the repository cannot point outside it. */
  const canonical = (p: string) => { let cur = p; while (!existsSync(cur)) { const up = dirname(cur); if (up === cur) break; cur = up; } return realpathSync(cur) + p.slice(cur.length); };
  const inside = (p: string) => { const abs = canonical(isAbsolute(p) ? resolve(p) : resolve(root, p)); return abs === root || abs.startsWith(root + sep); };
  const deny = (reason: string) => ({ hookSpecificOutput: { hookEventName: "PreToolUse" as const, permissionDecision: "deny" as const, permissionDecisionReason: reason } });
  return async (input) => {
    if (input.hook_event_name !== "PreToolUse") return {};
    const ti = (input.tool_input ?? {}) as Record<string, unknown>;
    for (const key of ["file_path", "path", "notebook_path", "cwd", "directory"]) {
      const p = ti[key];
      if (typeof p === "string" && p.length > 0 && !inside(p)) return deny(`Path "${p}" is outside the repository under review. Only files under ${root} may be read.`);
    }
    // Glob's `pattern` is itself a path: absolute or parent-traversing patterns escape the workspace.
    const pattern = ti.pattern;
    if (input.tool_name === "Glob" && typeof pattern === "string" && (isAbsolute(pattern) || pattern.startsWith("~") || /(^|[\/])\.\.([\/]|$)/.test(pattern))) return deny(`Glob pattern "${pattern}" must be relative to the repository and must not traverse upwards.`);
    return {};
  };
}

/** Bump when runner semantics change in a way that makes earlier predictions incomparable. */
export const PIPELINE_VERSION = "3";

/** Digest of every task field that reaches a prompt, over the ordered instance set, plus the calibration memory if present. */
export function inputsDigest(instances: TaskInstance[]): string {
  const h = createHash("sha256");
  for (const i of instances) h.update(JSON.stringify([i.instance_id, i.repo, i.base_commit, i.problem_statement, i.patch, i.test_patch, i.FAIL_TO_PASS]));
  const cal = `${ROOT}data/eval/calibration.json`;
  if (existsSync(cal)) h.update(readFileSync(cal));
  return h.digest("hex").slice(0, 16);
}

/** Stable fingerprint of what a run is: pipeline + verifier version, variant, model, the exact prompts, tools, schema, limits and the full input set — so resumes cannot mix systems or inputs. */
export function runFingerprint(variant: Variant, model: string, sampleInst: TaskInstance, instances: TaskInstance[] = [sampleInst]): string {
  const built = variant.build(sampleInst, { model, workspace: "/workspace" });
  const agents = Object.fromEntries(Object.entries(built.options.agents ?? {}).map(([k, a]) => [k, { prompt: a.prompt, tools: a.tools, model: a.model }]));
  return createHash("sha256").update(JSON.stringify({
    pipeline: PIPELINE_VERSION, verifier: VERIFIER_VERSION, variant: variant.name, model, inputs: inputsDigest(instances),
    prompt: built.prompt, systemPrompt: built.options.systemPrompt, tools: built.options.tools, allowedTools: built.options.allowedTools,
    hooks: Object.keys(built.options.hooks ?? {}), agents, outputSchema: built.options.outputFormat ?? VERDICT_JSON_SCHEMA,
    maxTurns: built.options.maxTurns, maxBudgetUsd: built.options.maxBudgetUsd, maxRetries: variant.maxRetries ?? 0, hasValidator: Boolean(variant.validate),
  })).digest("hex").slice(0, 16);
}

/** Errors that mean "stop the whole run now" rather than "this instance failed". */
const FATAL = /session limit|usage limit|rate limit|hit your|credit balance|authentication|not logged in/i;
class FatalRunError extends Error {}

function loadDone(dir: string, retryErrors: boolean): Set<string> {
  const path = `${dir}/predictions.jsonl`;
  if (!existsSync(path)) return new Set();
  const raw = readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Prediction);
  // Exactly one prediction per instance: if a file ever holds duplicates (e.g. two processes appended), keep the last.
  const byId = new Map<string, Prediction>();
  const ledger = (p: Prediction, why: string) => appendFileSync(`${dir}/attempts-errored.jsonl`, `${JSON.stringify({ ...p, superseded_reason: why, superseded_at: new Date().toISOString() })}\n`);
  // Exactly one prediction per instance. Any superseded row (duplicate from a concurrent append) goes to the ledger
  // before it is dropped, so its cost and existence survive.
  for (const p of raw) { const prev = byId.get(p.instance_id); if (prev) ledger(prev, "duplicate row superseded by a later one"); byId.set(p.instance_id, p); }
  let preds = [...byId.values()];
  if (byId.size < raw.length) console.warn(`predictions.jsonl had ${raw.length - byId.size} duplicate instance row(s); superseded rows moved to attempts-errored.jsonl`);
  if (retryErrors) {
    const dropped = preds.filter((p) => !p.verdict);
    for (const p of dropped) {
      ledger(p, "errored attempt retried");
      // keep the failed attempt's trajectory under an attempt suffix instead of overwriting it
      const t = trajectoryPath(p.run_id, p.instance_id);
      if (existsSync(t)) { let n = 1; while (existsSync(t.replace(/\.jsonl$/, `.attempt-${n}.jsonl`))) n++; renameSync(t, t.replace(/\.jsonl$/, `.attempt-${n}.jsonl`)); }
    }
    preds = preds.filter((p) => p.verdict);
    if (dropped.length) console.log(`moved ${dropped.length} errored prediction(s) to attempts-errored.jsonl for re-run`);
  }
  if (preds.length !== raw.length) { const tmp = `${path}.${process.pid}.tmp`; writeFileSync(tmp, preds.map((p) => `${JSON.stringify(p)}\n`).join("")); renameSync(tmp, path); }
  return new Set(preds.map((p) => p.instance_id));
}

async function drain(q: AsyncIterable<SDKMessage>, traj: TrajectoryWriter): Promise<SDKResultMessage | undefined> {
  let result: SDKResultMessage | undefined;
  for await (const m of q) {
    traj.record(m);
    if (m.type === "result") result = m;
  }
  return result;
}

function verdictFrom(r: SDKResultMessage | undefined): { verdict: Verdict | null; error?: string } {
  if (!r) return { verdict: null, error: "no result message" };
  if (r.subtype !== "success") return { verdict: null, error: `result subtype ${r.subtype}` };
  if (r.structured_output != null) {
    try { return { verdict: parseVerdict(r.structured_output) }; } catch (e) { return { verdict: null, error: `structured_output invalid: ${(e as Error).message.slice(0, 200)}` }; }
  }
  const v = extractVerdict(r.result);
  return v ? { verdict: v } : { verdict: null, error: "no verdict in result text" };
}

export async function runOne(variant: Variant, inst: TaskInstance, opts: Pick<RunOpts, "runId" | "model">): Promise<Prediction> {
  const ctx: RunContext = { model: opts.model, workspace: workspaceDir(inst.instance_id) };
  const { prompt, options } = variant.build(inst, ctx);
  // The trajectory header carries no labels: `human` and `stratum` are appended only after the model has finished.
  const traj = new TrajectoryWriter(trajectoryPath(opts.runId, inst.instance_id), {
    run_id: opts.runId, variant: variant.name, instance_id: inst.instance_id, model: opts.model,
    system_prompt: options.systemPrompt, prompt, tools: options.tools, allowedTools: options.allowedTools, agents: options.agents && Object.fromEntries(Object.entries(options.agents).map(([k, a]) => [k, { description: a.description, tools: a.tools, model: a.model, prompt: a.prompt }])),
  });
  const guard = { matcher: "Read|Grep|Glob|NotebookRead", hooks: [workspaceGuard(ctx.workspace)] };
  const hooks = { ...(options.hooks ?? {}), PreToolUse: [guard, ...(options.hooks?.PreToolUse ?? [])] };
  const base: Options = { model: opts.model, permissionMode: "dontAsk", settingSources: [], strictMcpConfig: true, persistSession: true, ...options, hooks };
  const t0 = Date.now();
  let cost = 0, turns = 0, inTok = 0, outTok = 0, cacheTok = 0, retries = 0, sessionId: string | undefined;
  let outcome: { verdict: Verdict | null; error?: string } = { verdict: null, error: "not run" };
  let verified: boolean | undefined;
  try {
    let r = await drain(query({ prompt, options: base }), traj);
    const tally = (m: SDKResultMessage | undefined) => { if (!m) return; cost += m.total_cost_usd; turns += m.num_turns; inTok += m.usage.input_tokens; outTok += m.usage.output_tokens; cacheTok += m.usage.cache_read_input_tokens; sessionId = m.session_id; };
    tally(r);
    outcome = verdictFrom(r);
    const maxRetries = variant.maxRetries ?? 0;
    while (retries < maxRetries && sessionId) {
      const problems = outcome.verdict ? (variant.validate?.(outcome.verdict, inst, ctx) ?? []) : [outcome.error ?? "no verdict"];
      if (problems.length === 0) break;
      retries++;
      traj.note("verification_failed", { attempt: retries, problems });
      const feedback = `Your verdict did not pass verification. Problems:\n${problems.map((p) => `- ${p}`).join("\n")}\n\nFix these: re-check the cited locations with your tools, correct or replace the evidence, and adjust scores only if the evidence warrants it. Then return the complete corrected verdict.`;
      traj.note("retry_prompt", { text: feedback });
      r = await drain(query({ prompt: feedback, options: { ...base, resume: sessionId } }), traj);
      tally(r);
      outcome = verdictFrom(r);
    }
    if (outcome.verdict && variant.validate) {
      const problems = variant.validate(outcome.verdict, inst, ctx);
      verified = problems.length === 0;
      traj.note("verification_final", { passed: verified, problems });
      // A verdict that still fails verification after the retries is not a result: store it as an error so the
      // scorer counts it as missing and a resume with --retry-errors runs it again.
      if (!verified) outcome = { verdict: null, error: `verification failed after ${retries} retries: ${problems.slice(0, 3).join(" | ").slice(0, 400)}` };
    }
  } catch (e) {
    outcome = { verdict: null, error: `exception: ${(e as Error).message.slice(0, 300)}` };
    traj.note("exception", { message: (e as Error).message });
    if (FATAL.test((e as Error).message)) throw new FatalRunError((e as Error).message);
  }
  if ("human" in inst) { const ev = inst as EvalInstance; traj.note("ground_truth", { human: ev.human, stratum: ev.stratum, challenging: ev.challenging ?? false }); }
  return {
    run_id: opts.runId, variant: variant.name, instance_id: inst.instance_id, verdict: outcome.verdict, error: outcome.error, verified,
    cost_usd: cost, duration_ms: Date.now() - t0, num_turns: turns, input_tokens: inTok, output_tokens: outTok, cache_read_tokens: cacheTok, retries, session_id: sessionId,
  };
}

export async function runAll(variant: Variant, opts: RunOpts) {
  const dir = resultsDir(opts.runId);
  mkdirSync(dir, { recursive: true });
  const predPath = `${dir}/predictions.jsonl`;
  const runJson = `${dir}/run.json`;
  // One process per run directory, acquired atomically (O_EXCL) before anything is read or truncated.
  const lock = `${dir}/run.lock`;
  const acquire = () => { try { const fd = openSync(lock, "wx"); writeFileSync(fd, String(process.pid)); closeSync(fd); return true; } catch { return false; } };
  if (!acquire()) {
    const pid = Number(readFileSync(lock, "utf8"));
    let alive = false; try { process.kill(pid, 0); alive = true; } catch { /* stale */ }
    if (alive) { console.error(`run "${opts.runId}" is already being executed by process ${pid}; refusing to start a second runner on the same run id.`); process.exit(2); }
    unlinkSync(lock);
    if (!acquire()) { console.error(`could not acquire ${lock}`); process.exit(2); }
  }
  process.on("exit", () => { try { if (Number(readFileSync(lock, "utf8")) === process.pid) unlinkSync(lock); } catch { /* already gone */ } });
  const fingerprint = runFingerprint(variant, opts.model, opts.instances[0]!, opts.instances);
  if (opts.force) { writeFileSync(predPath, ""); if (existsSync(`${dir}/attempts-errored.jsonl`)) writeFileSync(`${dir}/attempts-errored.jsonl`, ""); }
  else if (existsSync(runJson)) {
    const prev = JSON.parse(readFileSync(runJson, "utf8")) as { fingerprint?: string; variant?: string; model?: string };
    if (prev.fingerprint && prev.fingerprint !== fingerprint) {
      console.error(`run "${opts.runId}" was started with ${prev.variant}/${prev.model} (fingerprint ${prev.fingerprint}); refusing to resume it with ${variant.name}/${opts.model} (${fingerprint}). Use a new --run-id or --force.`);
      process.exit(2);
    }
  }
  const done = loadDone(dir, opts.retryErrors);
  writeFileSync(runJson, JSON.stringify({ run_id: opts.runId, variant: variant.name, description: variant.description, model: opts.model, fingerprint, started_at: new Date().toISOString(), n_instances: opts.instances.length }, null, 2));
  const queue = opts.instances.filter((i) => !done.has(i.instance_id));
  console.log(`[${opts.runId}] variant=${variant.name} model=${opts.model} todo=${queue.length} done=${done.size}`);
  const t0 = Date.now();
  let fatal: Error | undefined;
  await Promise.all(Array.from({ length: opts.concurrency }, async () => {
    for (let inst = queue.shift(); inst && !fatal; inst = queue.shift()) {
      let p: Prediction;
      try { p = await runOne(variant, inst, opts); }
      catch (e) { fatal ??= e as Error; queue.length = 0; console.error(`FATAL — stopping run: ${(e as Error).message.slice(0, 200)}`); break; }
      appendFileSync(predPath, `${JSON.stringify(p)}\n`);
      const v = p.verdict;
      console.log(`${inst.instance_id.padEnd(36)} human us=${inst.human.underspecified} fn=${inst.human.false_negative} | pred ${v ? `us=${v.underspecified} fn=${v.false_negative} ${v.decision}` : `ERROR ${p.error}`} | $${p.cost_usd.toFixed(3)} ${(p.duration_ms / 1000).toFixed(0)}s turns=${p.num_turns}${p.retries ? ` retries=${p.retries}` : ""}`);
    }
  }));
  console.log(`[${opts.runId}] ${fatal ? "stopped" : "finished"} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  if (fatal) process.exit(3);
}
