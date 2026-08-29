/**
 * Build the fixed evaluation set: a seeded, stratified sample of SWE-bench test
 * instances joined with OpenAI's ensembled human annotations.
 *
 * Usage: node src/data/build-eval-set.ts [--n 30] [--seed 20260828]
 * Output: data/eval/instances.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import type { EvalInstance, HumanAnnotation, Stratum } from "../lib/types.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i]!.replace(/^--/, ""), process.argv[i + 1] ?? "");
const N = Number(args.get("n") ?? 30);
const SEED = Number(args.get("seed") ?? 20260828);

// Stratum quotas (sum to N when N=30). Scaled proportionally otherwise.
const QUOTA: Record<Stratum, number> = { clean: 10, underspecified: 8, unfair_tests: 8, both: 4 };
const MAX_PER_REPO = 5;
const MAX_CHARS = { problem_statement: 12_000, patch: 15_000, test_patch: 15_000 };
/** Designated "challenging case": issue asks for `mask`, tests require `mask_invalid`. */
const FORCE_INCLUDE: Array<{ id: string; stratum: Stratum }> = [{ id: "astropy__astropy-12544", stratum: "unfair_tests" }];

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(xs: T[], rnd: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const score = (s: string) => Number(s) as 0 | 1 | 2 | 3;
function stratumOf(h: HumanAnnotation): Stratum {
  const us = h.underspecified >= 2, fn = h.false_negative >= 2;
  return us && fn ? "both" : us ? "underspecified" : fn ? "unfair_tests" : "clean";
}

// --- load annotations -------------------------------------------------------
const csv = parse(readFileSync(`${ROOT}data/raw/ensembled_annotations_public.csv`, "utf8"), { columns: true }) as Record<string, string>[];
const human = new Map<string, HumanAnnotation>();
for (const r of csv) {
  human.set(r.instance_id!, {
    underspecified: score(r.underspecified!), underspecified_notes: r.underspecified_notes ?? "",
    false_negative: score(r.false_negative!), false_negative_notes: r.false_negative_notes ?? "",
    other_major_issues: Number(r.other_major_issues) as 0 | 1, other_notes: r.other_notes ?? "",
    difficulty: r.difficulty ?? "", filter_out: r.filter_out === "True",
  });
}
console.log(`annotations: ${human.size}`);

// --- load SWE-bench test split ---------------------------------------------
const file = await asyncBufferFromFile(`${ROOT}data/raw/swebench_test.parquet`);
const rows = (await parquetReadObjects({ file })) as Record<string, string>[];
console.log(`swe-bench test rows: ${rows.length}`);
const byId = new Map(rows.map((r) => [r.instance_id!, r]));

// --- candidate pool ---------------------------------------------------------
type Cand = { inst: EvalInstance; stratum: Stratum };
const pool: Cand[] = [];
for (const [id, h] of human) {
  const r = byId.get(id);
  if (!r) continue;
  if (h.other_major_issues !== 0) continue; // keep labels about the two axes only
  const inst: EvalInstance = {
    instance_id: id, repo: r.repo!, base_commit: r.base_commit!, version: r.version!, created_at: String(r.created_at),
    problem_statement: r.problem_statement!, hints_text: r.hints_text ?? "", patch: r.patch!, test_patch: r.test_patch!,
    FAIL_TO_PASS: JSON.parse(r.FAIL_TO_PASS!), PASS_TO_PASS: JSON.parse(r.PASS_TO_PASS!), human: h, stratum: stratumOf(h),
  };
  pool.push({ inst, stratum: inst.stratum });
}
const fits = (c: Cand) => c.inst.problem_statement.length <= MAX_CHARS.problem_statement && c.inst.patch.length <= MAX_CHARS.patch && c.inst.test_patch.length <= MAX_CHARS.test_patch;
console.log(`pool (other_major_issues=0, joined): ${pool.length}; fitting size limits: ${pool.filter(fits).length}`);

// --- sample -----------------------------------------------------------------
const rnd = mulberry32(SEED);
const scale = N / Object.values(QUOTA).reduce((a, b) => a + b, 0);
const chosen: EvalInstance[] = [];
const perRepo = new Map<string, number>();
const take = (c: Cand, challenging = false) => {
  perRepo.set(c.inst.repo, (perRepo.get(c.inst.repo) ?? 0) + 1);
  chosen.push(challenging ? { ...c.inst, challenging: true } : c.inst);
};
for (const f of FORCE_INCLUDE) {
  const c = pool.find((p) => p.inst.instance_id === f.id);
  if (!c) throw new Error(`forced instance ${f.id} not in pool`);
  if (c.stratum !== f.stratum) throw new Error(`forced instance ${f.id} is stratum ${c.stratum}, expected ${f.stratum}`);
  take(c, true);
}
for (const stratum of Object.keys(QUOTA) as Stratum[]) {
  const want = Math.round(QUOTA[stratum] * scale) - chosen.filter((i) => i.stratum === stratum).length;
  const cands = shuffle(pool.filter((c) => c.stratum === stratum && fits(c) && !chosen.some((x) => x.instance_id === c.inst.instance_id)), rnd);
  let got = 0;
  for (const c of cands) {
    if (got >= want) break;
    if ((perRepo.get(c.inst.repo) ?? 0) >= MAX_PER_REPO) continue;
    take(c); got++;
  }
  if (got < want) console.warn(`stratum ${stratum}: wanted ${want}, got ${got}`);
}
chosen.sort((a, b) => a.instance_id.localeCompare(b.instance_id));

mkdirSync(`${ROOT}data/eval`, { recursive: true });
writeFileSync(`${ROOT}data/eval/instances.json`, JSON.stringify(chosen, null, 2));
console.log(`\nwrote ${chosen.length} instances -> data/eval/instances.json (seed ${SEED})`);
console.log(`stratum counts: ${(Object.keys(QUOTA) as Stratum[]).map((s) => `${s} ${chosen.filter((i) => i.stratum === s).length}`).join(" · ")}`);
console.log(`per repo: ${[...perRepo].map(([r, n]) => `${r} ${n}`).join(" · ")}`);
console.log("\nid                                      strat          us fn diff              ps    patch  test");
for (const i of chosen) console.log(`${i.instance_id.padEnd(40)}${i.stratum.padEnd(15)}${i.human.underspecified}  ${i.human.false_negative}  ${i.human.difficulty.padEnd(17)}${String(i.problem_statement.length).padStart(5)} ${String(i.patch.length).padStart(7)} ${String(i.test_patch.length).padStart(6)}${i.challenging ? "  <-- challenging" : ""}`);
