import { readFileSync } from "node:fs";
import { ROOT } from "./paths.ts";

export interface CalibrationExample { instance_id: string; underspecified: number; underspecified_notes: string; false_negative: number; false_negative_notes: string }
type Axis = "underspecified" | "false_negative";

let cache: Record<string, CalibrationExample[]> | undefined;
/** Runtime leakage guard: the calibration memory must never contain an evaluation instance. */
const load = () => {
  if (cache) return cache;
  const data = JSON.parse(readFileSync(`${ROOT}data/eval/calibration.json`, "utf8")) as Record<string, CalibrationExample[]>;
  const evalIds = new Set((JSON.parse(readFileSync(`${ROOT}data/eval/instances.json`, "utf8")) as Array<{ instance_id: string }>).map((i) => i.instance_id));
  const leaked = Object.values(data).flat().filter((e) => evalIds.has(e.instance_id)).map((e) => e.instance_id);
  if (leaked.length) throw new Error(`calibration.json contains evaluation instances: ${leaked.join(", ")} — rebuild it with npm run data:calibration`);
  return (cache = data);
};

/** Deterministic string hash so example selection is reproducible per instance. */
function hash(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/**
 * Pick human-annotated examples from the same repository (never the instance itself, never any eval instance):
 * for the axis, one low-scored (<=1) and two high-scored (>=2) examples, deterministic per instance.
 */
export function calibrationExamples(repo: string, instanceId: string, axis: Axis, perBucket = { low: 2, high: 2 }): CalibrationExample[] {
  const pool = (load()[repo] ?? []).filter((e) => e.instance_id !== instanceId);
  const pick = (xs: CalibrationExample[], n: number) => xs
    .map((e) => ({ e, k: hash(`${instanceId}|${axis}|${e.instance_id}`) }))
    .sort((a, b) => a.k - b.k).slice(0, n).map((x) => x.e);
  return [...pick(pool.filter((e) => e[axis] <= 1), perBucket.low), ...pick(pool.filter((e) => e[axis] >= 2), perBucket.high)];
}

export function renderCalibration(repo: string, instanceId: string, axis: Axis): string {
  const xs = calibrationExamples(repo, instanceId, axis);
  if (xs.length === 0) return "";
  const notes = axis === "underspecified" ? "underspecified_notes" : "false_negative_notes";
  return `## Calibration: how human annotators scored ${axis} on other ${repo} issues
These are different issues from the same repository (scores are the max over three annotators). Use them to
calibrate what a 0/1 versus a 2/3 looks like on this codebase — not as facts about the current task.
${xs.map((e) => `- ${e.instance_id} → ${axis}=${e[axis]}: ${e[notes]}`).join("\n")}`;
}
