import type { TaskInstance } from "./types.ts";

/** The task material shown to every system. Identical for baseline and agent variants. */
export function renderInstance(inst: TaskInstance): string {
  return `# Candidate task: ${inst.instance_id}
Repository: ${inst.repo} @ ${inst.base_commit}${inst.version ? ` (version ${inst.version})` : ""}

## Issue text (this is ALL the solver will see)
<issue>
${inst.problem_statement.trim()}
</issue>

## Gold patch (the original PR's code change — the solver does NOT see this)
<gold_patch>
${inst.patch.trim()}
</gold_patch>

## Test patch (the hidden tests applied to the solver's code — the solver does NOT see this)
<test_patch>
${inst.test_patch.trim()}
</test_patch>

## FAIL_TO_PASS tests (must go from failing to passing)
${inst.FAIL_TO_PASS.map((t) => `- ${t}`).join("\n")}
`;
}
