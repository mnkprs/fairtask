import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { TaskInstance, Evidence, Verdict } from "./types.ts";

/**
 * Deterministic *containment* verification of a verdict's evidence. It checks that every quoted excerpt really
 * exists where the verdict says it does; it does not judge whether the excerpt supports the claim — that remains
 * the reviewer's job, which is why the verdict hands them the exact location.
 */

/** Bump whenever verification semantics change: it is part of every run's fingerprint, so old runs cannot be resumed under new rules. */
export const VERIFIER_VERSION = "3";

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
  // A quote that uses elision syntax must keep text on both sides of every "...": a lone prefix such as
  // `long_name = ...` would otherwise "verify" against any value of long_name.
  if (frags.length < 2) return { index: -1, problem: `quote not found verbatim, and "..." with only one fragment cannot be verified: "${frags[0]!.slice(0, 60)}"` };
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

/** Per-hunk view of a unified diff: the "new side" (context + added lines) and the removed lines of ONE hunk, normalized. */
export interface PatchHunk { path: string; header: string; newSide: string; removed: string }

export function parsePatch(patch: string): PatchHunk[] {
  const hunks: PatchHunk[] = [];
  let path = "";
  let cur: { header: string; newLines: string[]; removedLines: string[] } | undefined;
  const flush = () => { if (cur) hunks.push({ path, header: cur.header, newSide: norm(cur.newLines.join("\n")), removed: norm(cur.removedLines.join("\n")) }); cur = undefined; };
  for (const line of patch.split("\n")) {
    const m = line.match(/^diff --git a\/(\S+) b\/(\S+)/);
    if (m) { flush(); path = m[2]!; continue; }
    if (line.startsWith("@@")) { flush(); cur = { header: line, newLines: [], removedLines: [] }; continue; }
    if (!cur || /^(index |--- |\+\+\+ )/.test(line)) continue;
    if (line.startsWith("+")) cur.newLines.push(line.slice(1));
    else if (line.startsWith("-")) cur.removedLines.push(line.slice(1));
    else cur.newLines.push(line.startsWith(" ") ? line.slice(1) : line);
  }
  flush();
  return hunks;
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
  const hunks = parsePatch(patch);
  const ref = e.ref.replace(/^[ab]\//, "").replace(/:L?\d+(-L?\d+)?$/, "");
  const fileHunks = hunks.filter((h) => h.path === ref || h.path.endsWith(`/${ref}`) || ref.endsWith(`/${h.path}`));
  if (fileHunks.length === 0) return `evidence ref "${e.ref}" is not a file touched by ${label} (touched: ${[...new Set(hunks.map((h) => h.path))].join(", ") || "none"})`;
  // Route each quoted line by its diff marker: "-" lines must exist among the removed lines, everything else on the
  // new side (context + added). Both sides must come from the SAME hunk — a quote stitched together from distant
  // hunks is not a quote. A quote made only of removed lines is rejected: deleted code is not evidence of what the
  // tests now require; an honest before/after quote ("-old" + "+new") verifies on both sides.
  const lines = e.quote.split("\n");
  const minus = lines.filter((l) => /^-(?!--)/.test(l)).map((l) => l.slice(1)).join("\n");
  const plus = lines.filter((l) => !/^-(?!--)/.test(l)).map((l) => l.replace(/^[+ ]/, "")).join("\n");
  const file = fileHunks[0]!.path;
  if (norm(plus).length === 0) {
    return fileHunks.some((h) => findQuote(h.removed, minus).index >= 0)
      ? `evidence quote in ${label} "${file}" matches only REMOVED lines (deleted code is not evidence of the new behaviour)`
      : `evidence quote not found in ${label} "${file}"`;
  }
  let plusProblem = "", minusProblem = "";
  for (const h of fileHunks) {
    const foundNew = findQuote(h.newSide, plus);
    if (foundNew.index < 0) { plusProblem ||= foundNew.problem ?? "not found"; continue; }
    if (norm(minus).length >= 8 && findQuote(h.removed, minus).index < 0) { minusProblem = `the "-" lines of the evidence quote are not among the lines the same hunk removes`; continue; }
    return null;
  }
  if (minusProblem) return `evidence quote not found within a single hunk of ${label} "${file}": ${minusProblem}`;
  if (fileHunks.some((h) => findQuote(h.removed, plus).index >= 0)) return `evidence quote in ${label} "${file}" matches only REMOVED lines (deleted code is not evidence of the new behaviour)`;
  return `evidence quote not found within a single hunk of ${label} "${file}" (${plusProblem})`;
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
