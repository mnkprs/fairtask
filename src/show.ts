/**
 * Write a task's pieces as separate, readable files — what a solver sees (the issue), what grades them (the test
 * patch), what the original author did (the gold patch), and, for evaluation instances, the human labels.
 *
 * Usage: npm run show -- <instance_id> [--out examples]      (instance must be in data/eval/instances.json)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import type { EvalInstance } from "./lib/types.ts";
import { ROOT, assertSlug } from "./lib/paths.ts";

const [id, ...rest] = process.argv.slice(2);
if (!id) { console.error("usage: npm run show -- <instance_id> [--out <dir>]"); process.exit(2); }
assertSlug("instance_id", id);
const outRoot = rest.includes("--out") ? rest[rest.indexOf("--out") + 1]! : `${ROOT}examples`;
const inst = (JSON.parse(readFileSync(`${ROOT}data/eval/instances.json`, "utf8")) as EvalInstance[]).find((i) => i.instance_id === id);
if (!inst) { console.error(`${id} is not in data/eval/instances.json`); process.exit(1); }
const dir = `${outRoot}/${id}`;
mkdirSync(dir, { recursive: true });
// SWE-bench instance ids are <owner>__<repo>-<PR number>; the issue itself is linked from the PR page.
const pr = id.match(/-(\d+)$/)?.[1];
const links = [
  `- Repository: https://github.com/${inst.repo}`,
  `- Base commit (the code a solver gets): https://github.com/${inst.repo}/commit/${inst.base_commit}`,
  pr ? `- Fixing pull request (gold patch + test patch; the original issue is linked from it): https://github.com/${inst.repo}/pull/${pr}` : undefined,
  `- SWE-bench instance: \`${id}\` (dataset princeton-nlp/SWE-bench, test split)`,
].filter(Boolean).join("\n");
writeFileSync(`${dir}/issue.md`, `# ${id} — the issue text (all a solver sees)\n\n${links}\n\n---\n\n${inst.problem_statement.trim()}\n`);
writeFileSync(`${dir}/test.patch`, inst.test_patch);
writeFileSync(`${dir}/gold.patch`, inst.patch);
writeFileSync(`${dir}/human-labels.md`, `# ${id} — human labels (OpenAI, 2024; max over three annotators)\n\nSource: data/raw/ensembled_annotations_public.csv (provenance in data/raw/SOURCES.md)${pr ? `; task: https://github.com/${inst.repo}/pull/${pr}` : ""}\n\n| axis | score |\n|---|---|\n| underspecified | ${inst.human.underspecified} |\n| false_negative | ${inst.human.false_negative} |\n| filter_out | ${inst.human.filter_out} |\n\n## Annotator note — issue\n\n${inst.human.underspecified_notes.trim()}\n\n## Annotator note — tests\n\n${inst.human.false_negative_notes.trim()}\n\n## Graded tests (FAIL_TO_PASS)\n\n${inst.FAIL_TO_PASS.map((t) => `- \`${t}\``).join("\n")}\n`);
console.log(`wrote ${dir}/{issue.md,test.patch,gold.patch,human-labels.md}`);
