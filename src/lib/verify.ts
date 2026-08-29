import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { TaskInstance, Evidence, Verdict } from "./types.ts";

/**
 * Deterministic *containment* verification of a verdict's evidence. It checks that every quoted excerpt really
 * exists where the verdict says it does; it does not judge whether the excerpt supports the claim — that remains
 * the reviewer's job, which is why the verdict hands them the exact location.
 */

/** Collapse whitespace so quotes can be matched loosely but honestly. Diff markers are handled by the patch parser. */
export const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Max distance (in normalized chars) allowed between consecutive elided fragments of one quote. */
const MAX_ELISION_GAP = 4000;

/** Split a quote on elision markers ("..." / "…") into normalized fragments. */
export function splitElisions(quote: string): string[] {
  return quote.split(/\.\.\.|…/).map(norm).filter(Boolean);
}

/**
 * Find a quote in a normalized haystack. The whole quote is tried literally first (so a genuine literal "..." in
 * code verifies); only then is "..." read as an elision: every fragment verbatim, in order, with bounded gaps and a
 * minimum fragment length, so `value = ...` cannot be "verified" by the 7-character stub "value =".
 */
export function findQuote(haystack: string, quote: string): { index: number; problem?: string } {
  const literal = norm(quote);
  if (literal.length >= 8 && haystack.includes(literal)) return { index: haystack.indexOf(literal) };
  const frags = splitElisions(quote);
  if (frags.length === 0) return { index: -1, problem: "quote is empty" };
  const short = frags.find((f) => f.length < 8);
  if (short !== undefined) return { index: -1, problem: `quote fragment "${short}" is too short to verify` };
  let pos = 0, first = -1;
  for (const f of frags) {
    const i = haystack.indexOf(f, pos);
    if (i < 0) return { index: -1, problem: `fragment not found${pos ? " after the previous fragment" : ""}: "${f.slice(0, 80)}"` };
    if (first >= 0 && i - pos > MAX_ELISION_GAP) return { index: -1, problem: `fragments are too far apart to be one quote (gap ${i - pos} chars)` };
    if (first < 0) first = i;
    pos = i + f.length;
  }
  return { index: first };
}

/** Per-file view of a unified diff: the "new side" (context + added lines) and the removed lines, both normalized. */
export interface PatchFile { path: string; newSide: string; removed: string }

export function parsePatch(patch: string): PatchFile[] {
  const files: PatchFile[] = [];
  let cur: { path: string; newLines: string[]; removedLines: string[] } | undefined;
  for (const line of patch.split("\n")) {
    const m = line.match(/^diff --git a\/(\S+) b\/(\S+)/);
    if (m) { if (cur) files.push({ path: cur.path, newSide: norm(cur.newLines.join("\n")), removed: norm(cur.removedLines.join("\n")) }); cur = { path: m[2]!, newLines: [], removedLines: [] }; continue; }
    if (!cur) continue;
    if (/^(index |--- |\+\+\+ |@@ )/.test(line)) continue;
    if (line.startsWith("+")) cur.newLines.push(line.slice(1));
    else if (line.startsWith("-")) cur.removedLines.push(line.slice(1));
    else cur.newLines.push(line.startsWith(" ") ? line.slice(1) : line);
  }
  if (cur) files.push({ path: cur.path, newSide: norm(cur.newLines.join("\n")), removed: norm(cur.removedLines.join("\n")) });
  return files;
}

function checkRepoQuote(e: Evidence, workspace: string): string | null {
  const m = e.ref.match(/^([^:\s]+?)(?::L?(\d+)(?:-L?(\d+))?)?$/);
  if (!m) return `evidence ref "${e.ref}" is not "path" or "path:L<start>-L<end>"`;
  const rel = m[1]!;
  const abs = resolve(workspace, rel);
  if (!abs.startsWith(resolve(workspace) + sep)) return `evidence ref "${rel}" escapes the repository`;
  if (!existsSync(abs) || !statSync(abs).isFile()) return `evidence ref "${rel}" does not exist in the repository at the base commit`;
  const text = readFileSync(abs, "utf8");
  const found = findQuote(norm(text), e.quote);
  if (found.index < 0) return `evidence quote not found in "${rel}" (${found.problem})`;
  if (m[2]) {
    const start = Number(m[2]), end = Number(m[3] ?? m[2]);
    const lines = text.split("\n");
    const window = norm(lines.slice(Math.max(0, start - 1 - 15), Math.min(lines.length, end + 15)).join("\n"));
    if (findQuote(window, e.quote).index < 0) return `evidence quote exists in "${rel}" but not near lines ${start}-${end}; cite the correct line range`;
  }
  return null;
}

/**
 * A patch quote must name a file that the patch touches and appear on that file's *new side* (context + added
 * lines). A quote that exists only among removed lines is rejected: deleted code is not evidence of what the tests
 * now require.
 */
function checkPatchQuote(e: Evidence, patch: string, label: string): string | null {
  const files = parsePatch(patch);
  const ref = e.ref.replace(/^[ab]\//, "").replace(/:L?\d+(-L?\d+)?$/, "");
  const file = files.find((f) => f.path === ref || f.path.endsWith(`/${ref}`) || ref.endsWith(`/${f.path}`));
  if (!file) return `evidence ref "${e.ref}" is not a file touched by ${label} (touched: ${files.map((f) => f.path).join(", ") || "none"})`;
  // Route each quoted line by its diff marker: "-" lines must exist among the removed lines, everything else on the
  // new side (context + added). A quote made only of removed lines is rejected — deleted code is not evidence of
  // what the tests now require — but an honest before/after quote ("-old" + "+new") verifies on both sides.
  const lines = e.quote.split("\n");
  const minus = lines.filter((l) => /^-(?!--)/.test(l)).map((l) => l.slice(1)).join("\n");
  const plus = lines.filter((l) => !/^-(?!--)/.test(l)).map((l) => l.replace(/^[+ ]/, "")).join("\n");
  if (norm(plus).length === 0) {
    return findQuote(file.removed, minus).index >= 0
      ? `evidence quote in ${label} "${file.path}" matches only REMOVED lines (deleted code is not evidence of the new behaviour)`
      : `evidence quote not found in ${label} "${file.path}"`;
  }
  const foundNew = findQuote(file.newSide, plus);
  if (foundNew.index < 0) {
    if (findQuote(file.removed, plus).index >= 0) return `evidence quote in ${label} "${file.path}" matches only REMOVED lines (deleted code is not evidence of the new behaviour)`;
    return `evidence quote not found in ${label} "${file.path}" (${foundNew.problem})`;
  }
  if (norm(minus).length >= 8) { const foundOld = findQuote(file.removed, minus); if (foundOld.index < 0) return `the "-" lines of the evidence quote are not among the lines ${label} removes in "${file.path}" (${foundOld.problem})`; }
  return null;
}

function checkTextQuote(e: Evidence, haystack: string, label: string): string | null {
  const found = findQuote(norm(haystack), e.quote);
  return found.index < 0 ? `evidence quote not found in ${label} (${found.problem})` : null;
}

/**
 * Independent verification of a verdict: every quote must exist where it is claimed to exist, and every score >= 2
 * must be backed by at least one verified evidence item for that axis. Returns human-readable problems.
 */
export function verifyVerdict(v: Verdict, inst: TaskInstance, workspace: string): string[] {
  const problems: string[] = [];
  const okByAxis = { underspecified: 0, false_negative: 0 };
  v.evidence.forEach((e, idx) => {
    let problem: string | null;
    switch (e.source) {
      case "repo": problem = checkRepoQuote(e, workspace); break;
      case "test_patch": problem = checkPatchQuote(e, inst.test_patch, "the test patch"); break;
      case "gold_patch": problem = checkPatchQuote(e, inst.patch, "the gold patch"); break;
      case "issue": problem = checkTextQuote(e, inst.problem_statement, "the issue text"); break;
      default: problem = `unknown evidence source ${String((e as Evidence).source)}`;
    }
    if (problem) problems.push(`evidence[${idx}] (${e.axis}): ${problem}`);
    else okByAxis[e.axis]++;
  });
  for (const axis of ["underspecified", "false_negative"] as const) {
    if (v[axis] >= 2 && okByAxis[axis] === 0) problems.push(`${axis} is scored ${v[axis]} but has no verified evidence item; cite a location and a verbatim quote, or lower the score`);
    if (v[`${axis}_rationale`].length < 100) problems.push(`${axis}_rationale is shorter than 100 characters`);
  }
  const shouldFlag = v.underspecified >= 2 || v.false_negative >= 2;
  if ((v.decision === "flag") !== shouldFlag) problems.push(`decision "${v.decision}" is inconsistent with scores (usable only if both <= 1)`);
  return problems;
}
