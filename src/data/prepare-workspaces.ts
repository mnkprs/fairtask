/**
 * Shallow-clone each evaluation instance's repository at its base_commit into workspaces/<instance_id>/repo.
 * Idempotent: skips workspaces already at the commit.
 *
 * Usage: node src/data/prepare-workspaces.ts [--only id1,id2] [--jobs 4]
 */
import { readFileSync } from "node:fs";
import type { EvalInstance } from "../lib/types.ts";
import { ROOT } from "../lib/paths.ts";
import { prepareWorkspace } from "../lib/workspace.ts";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i]!.replace(/^--/, ""), process.argv[i + 1] ?? "");
const only = args.get("only")?.split(",").filter(Boolean);
const JOBS = Number(args.get("jobs") ?? 4);

const instances = (JSON.parse(readFileSync(`${ROOT}data/eval/instances.json`, "utf8")) as EvalInstance[]).filter((i) => !only || only.includes(i.instance_id));
const t0 = Date.now();
const queue = instances.slice();
let failures = 0;
await Promise.all(Array.from({ length: JOBS }, async () => {
  for (let inst = queue.shift(); inst; inst = queue.shift()) {
    const s = Date.now();
    try { const r = await prepareWorkspace(inst); console.log(`${inst.instance_id.padEnd(40)} ok (${r.status})  ${((Date.now() - s) / 1000).toFixed(1)}s`); }
    catch (e) { failures++; console.error(`${inst.instance_id.padEnd(40)} FAILED: ${(e as Error).message.split("\n")[0]}`); }
  }
}));
console.log(`\n${instances.length - failures}/${instances.length} workspaces ready in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (failures) process.exit(1);
