/** Adversarial tests for the deterministic verifier. Run: node --test src/verify.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findQuote, norm, parsePatch, splitElisions, verifyVerdict } from "./lib/verify.ts";
import type { EvalInstance, Verdict } from "./lib/types.ts";

const patch = `diff --git a/pkg/mod.py b/pkg/mod.py
--- a/pkg/mod.py
+++ b/pkg/mod.py
@@ -1,4 +1,4 @@
 def read(path, mask=True):
-    assert old_behaviour(path) == 1
+    assert new_behaviour(path, mask_invalid=False) == 2
     return path
`;
const ws = mkdtempSync(join(tmpdir(), "tp-"));
mkdirSync(join(ws, "pkg"), { recursive: true });
writeFileSync(join(ws, "pkg", "mod.py"), "def read(path, mask=True):\n    value = ...\n    return path\n" + "x = 1\n".repeat(1000) + "tail_marker = True\n");
const inst = { problem_statement: "Ideally a keyword like mask=False would disable this.", patch, test_patch: patch } as EvalInstance;
const base = (evidence: Verdict["evidence"], us = 0, fn = 2): Verdict => ({ underspecified: us as 0, underspecified_rationale: "x".repeat(100), false_negative: fn as 2, false_negative_rationale: "y".repeat(100), evidence, decision: us >= 2 || fn >= 2 ? "flag" : "usable", confidence: 4 });
const ev = (o: Partial<Verdict["evidence"][number]>) => ({ axis: "false_negative" as const, claim: "c", source: "test_patch" as const, ref: "pkg/mod.py", quote: "", ...o });

test("a quote of an added line verifies", () => {
  assert.deepEqual(verifyVerdict(base([ev({ quote: "assert new_behaviour(path, mask_invalid=False) == 2" })]), inst, ws), []);
});
test("a verbatim patch quote that carries diff markers verifies", () => {
  assert.deepEqual(verifyVerdict(base([ev({ quote: "+    assert new_behaviour(path, mask_invalid=False) == 2\n     return path" })]), inst, ws), []);
});
test("a quote that exists only among removed lines is rejected", () => {
  const p = verifyVerdict(base([ev({ quote: "assert old_behaviour(path) == 1" })]), inst, ws);
  assert.match(p.join("\n"), /REMOVED lines/);
});
test("a patch ref naming a file the patch does not touch is rejected", () => {
  const p = verifyVerdict(base([ev({ ref: "pkg/other.py", quote: "assert new_behaviour(path, mask_invalid=False) == 2" })]), inst, ws);
  assert.match(p.join("\n"), /not a file touched/);
});
test("a literal '...' in code is matched verbatim, and cannot be 'verified' by its stub", () => {
  const p = verifyVerdict(base([ev({ source: "repo", ref: "pkg/mod.py:L1-L3", quote: "def read(path, mask=True):\n    value = ..." })]), inst, ws);
  assert.deepEqual(p, []);
  assert.ok(findQuote(norm("value = 5"), "value = ...").index < 0);
  assert.deepEqual(splitElisions("a = 1\n...\nb = 2"), ["a = 1", "b = 2"]);
});
test("an honest before/after patch quote verifies on both sides", () => {
  assert.deepEqual(verifyVerdict(base([ev({ quote: "-    assert old_behaviour(path) == 1\n+    assert new_behaviour(path, mask_invalid=False) == 2" })]), inst, ws), []);
  const p = verifyVerdict(base([ev({ quote: "-    assert something_never_removed == 1\n+    assert new_behaviour(path, mask_invalid=False) == 2" })]), inst, ws);
  assert.match(p.join("\n"), /"-" lines .* not among the lines/);
});
test("elided fragments far apart are rejected", () => {
  const p = verifyVerdict(base([ev({ source: "repo", ref: "pkg/mod.py", quote: "def read(path, mask=True):\n...\ntail_marker = True" })]), inst, ws);
  assert.match(p.join("\n"), /too far apart/);
});
test("a score >= 2 with no verified evidence for that axis is rejected", () => {
  const p = verifyVerdict(base([ev({ axis: "underspecified", source: "issue", ref: "issue", quote: "Ideally a keyword like mask=False" })]), inst, ws);
  assert.match(p.join("\n"), /false_negative is scored 2 but has no verified evidence/);
});
test("a fabricated repo quote and a wrong line range are rejected", () => {
  const p1 = verifyVerdict(base([ev({ source: "repo", ref: "pkg/mod.py", quote: "this line does not exist anywhere" })]), inst, ws);
  assert.match(p1.join("\n"), /not found/);
  const p2 = verifyVerdict(base([ev({ source: "repo", ref: "pkg/mod.py:L300-L310", quote: "def read(path, mask=True):" })]), inst, ws);
  assert.match(p2.join("\n"), /not near lines/);
});
test("parsePatch separates new side from removed lines per file", () => {
  const f = parsePatch(patch);
  assert.equal(f.length, 1); assert.equal(f[0]!.path, "pkg/mod.py");
  assert.ok(f[0]!.newSide.includes("mask_invalid=False")); assert.ok(!f[0]!.newSide.includes("old_behaviour")); assert.ok(f[0]!.removed.includes("old_behaviour"));
});
test("findQuote falls back to the literal quote", () => {
  assert.equal(findQuote(norm("x = f(a, ...)"), "f(a, ...)").index, 4);
});
