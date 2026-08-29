import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTable, renderTitle } from "./lib/table.ts";

test("markdown mode emits a pipe table with a separator row", () => {
  const md = renderTable(["A", "B"], [["**x**", "`y`"]], "markdown");
  assert.equal(md, "| A | B |\n|---|---|\n| **x** | `y` |");
});

test("terminal mode strips emphasis and pads every column to the same width", () => {
  const out = renderTable(["Metric", "κ"], [["**bold**", "0.29"], ["`run-id`", "▲ 1"]]);
  const lines = out.split("\n");
  assert.equal(lines.length, 6);
  assert.ok(lines.every((l) => Array.from(l).length === Array.from(lines[0]!).length), "all rows share one display width");
  assert.ok(!out.includes("**") && !out.includes("`"));
  assert.ok(out.includes("│ bold   │ 0.29 │"), out);
});

test("titles switch between a heading and an underline", () => {
  assert.equal(renderTitle("T", "markdown"), "### T\n");
  assert.equal(renderTitle("Ti"), "Ti\n══");
});
