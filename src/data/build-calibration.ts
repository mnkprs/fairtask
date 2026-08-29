/**
 * Build the calibration memory: human-annotated examples (scores + annotator notes) from instances that are NOT in
 * the evaluation set, grouped by repository. Used by the final variant to show the judge how humans calibrated the
 * scales on the same codebase. No evaluation instance ever appears here (leakage check enforced).
 *
 * Usage: node src/data/build-calibration.ts
 * Output: data/eval/calibration.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import type { EvalInstance } from "../lib/types.ts";
import { ROOT } from "../lib/paths.ts";

export interface CalibrationExample { instance_id: string; underspecified: number; underspecified_notes: string; false_negative: number; false_negative_notes: string }

const evalIds = new Set((JSON.parse(readFileSync(`${ROOT}data/eval/instances.json`, "utf8")) as EvalInstance[]).map((i) => i.instance_id));
const csv = parse(readFileSync(`${ROOT}data/raw/ensembled_annotations_public.csv`, "utf8"), { columns: true }) as Record<string, string>[];
const byRepo: Record<string, CalibrationExample[]> = {};
const trim = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 700);
for (const r of csv) {
  const id = r.instance_id!;
  if (evalIds.has(id)) continue;
  if (Number(r.other_major_issues) !== 0) continue;
  const repo = id.replace(/-\d+$/, "").replace("__", "/");
  const usNotes = trim(r.underspecified_notes ?? ""), fnNotes = trim(r.false_negative_notes ?? "");
  if (usNotes.length < 60 || fnNotes.length < 60) continue; // keep only examples with real explanations
  (byRepo[repo] ??= []).push({ instance_id: id, underspecified: Number(r.underspecified), underspecified_notes: usNotes, false_negative: Number(r.false_negative), false_negative_notes: fnNotes });
}
for (const id of Object.values(byRepo).flat().map((e) => e.instance_id)) if (evalIds.has(id)) throw new Error(`leak: ${id}`);
writeFileSync(`${ROOT}data/eval/calibration.json`, JSON.stringify(byRepo, null, 1));
console.log(Object.fromEntries(Object.entries(byRepo).map(([k, v]) => [k, v.length])));
