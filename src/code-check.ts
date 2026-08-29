/**
 * A code-based (no-LLM) pre-check for the unfair-tests axis, built during the evaluation audit:
 * does the test patch require an identifier that the GOLD PATCH introduced and that appears neither in the issue
 * text nor anywhere in the repository at the base commit? Such a name can only be guessed by a solver.
 *
 * Usage: node src/code-check.ts            (prints per-instance hits and TPR/TNR against the human false_negative label)
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { EvalInstance } from "./lib/types.ts";
import { ROOT, workspaceDir } from "./lib/paths.ts";
import { requireWorkspaces } from "./lib/audit.ts";

const STOP = new Set("self None True False def class return import from if else elif for while in not and or is assert with as try except raise pass lambda yield print len str int float list dict set tuple range isinstance type object super".split(" "));
const idents = (text: string) => new Set([...text.matchAll(/[A-Za-z_][A-Za-z0-9_]{2,}/g)].map((m) => m[0]).filter((w) => !STOP.has(w) && w !== w.toUpperCase()));
const added = (patch: string) => patch.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1)).join("\n");
const inRepo = (word: string, repo: string) => { try { execFileSync("grep", ["-rIlqw", "--exclude-dir=.git", word, repo], { stdio: "ignore" }); return true; } catch { return false; } };

/** Added test-patch lines that belong to a graded (FAIL_TO_PASS) test function; falls back to all added lines when no list is given. */
export function gradedAddedLines(inst: { test_patch: string; FAIL_TO_PASS: string[] }): string {
  const lines = added(inst.test_patch).split("\n").filter((l) => !/^\s*(#|import |from )/.test(l));
  const graded = new Set(inst.FAIL_TO_PASS.map((t) => t.split("::").pop()!.replace(/\[.*$/, "")));
  if (graded.size === 0) return lines.join("\n");
  const kept: string[] = []; let inGraded = false;
  for (const l of lines) {
    const def = l.match(/^\s*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (def) inGraded = graded.has(def[1]!);
    else if (/^\S/.test(l) && !l.startsWith("@")) inGraded = false; // top-level statement ends the function
    if (inGraded) kept.push(l);
  }
  return kept.join("\n");
}

export function novelIdentifiers(inst: EvalInstance): string[] {
  const fromTests = idents(gradedAddedLines(inst));
  const fromIssue = idents(inst.problem_statement);
  const fromGold = idents(added(inst.patch));
  const repo = workspaceDir(inst.instance_id);
  return [...fromTests].filter((w) => !fromIssue.has(w) && fromGold.has(w) && !inRepo(w, repo)).sort();
}

const instances = JSON.parse(readFileSync(`${ROOT}data/eval/instances.json`, "utf8")) as EvalInstance[];
requireWorkspaces(instances.map((i) => i.instance_id));
const rows = instances.map((i) => ({ id: i.instance_id, fn: i.human.false_negative, novel: novelIdentifiers(i) })).sort((a, b) => b.novel.length - a.novel.length);
console.log(`${"instance".padEnd(38)}fn  identifiers used by GRADED (FAIL_TO_PASS) tests, introduced by the gold patch, absent from issue and repo`);
for (const r of rows) console.log(`${r.id.padEnd(38)}${r.fn}   ${r.novel.length ? r.novel.slice(0, 6).join(", ") + (r.novel.length > 6 ? ` … (+${r.novel.length - 6})` : "") : "—"}`);
const hi = rows.filter((r) => r.fn >= 2), lo = rows.filter((r) => r.fn <= 1);
const tpr = hi.filter((r) => r.novel.length >= 1).length / hi.length, tnr = lo.filter((r) => r.novel.length === 0).length / lo.length;
console.log(`\nrule "flag if ≥ 1 novel identifier" vs human false_negative ≥ 2:  TPR ${(100 * tpr).toFixed(0)}%  TNR ${(100 * tnr).toFixed(0)}%  (n=${rows.length})`);
