/**
 * Run one system (baseline or an agent variant) over the evaluation set.
 *
 * Usage: node src/run.ts --variant <name> [--run-id <id>] [--model claude-opus-5] [--only id1,id2] [--concurrency 3] [--force] [--retry-errors]
 */
import { readFileSync } from "node:fs";
import type { EvalInstance } from "./lib/types.ts";
import { runAll } from "./lib/run.ts";
import { ROOT } from "./lib/paths.ts";
import { VARIANTS } from "./variants/index.ts";

const args = new Map<string, string>();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]!;
  if (!a.startsWith("--")) continue;
  const next = argv[i + 1];
  if (next === undefined || next.startsWith("--")) args.set(a.slice(2), "true");
  else { args.set(a.slice(2), next); i++; }
}
const variantName = args.get("variant");
const variant = variantName ? VARIANTS[variantName] : undefined;
if (!variant) {
  console.error(`--variant must be one of: ${Object.keys(VARIANTS).join(", ")}`);
  process.exit(2);
}
const model = args.get("model") ?? "claude-opus-5";
const only = args.get("only")?.split(",").filter(Boolean);
const instances = (JSON.parse(readFileSync(`${ROOT}data/eval/instances.json`, "utf8")) as EvalInstance[]).filter((i) => !only || only.includes(i.instance_id));
await runAll(variant, {
  runId: args.get("run-id") ?? variant.name,
  model,
  concurrency: Number(args.get("concurrency") ?? 3),
  force: args.get("force") === "true",
  retryErrors: args.get("retry-errors") === "true",
  instances,
});
