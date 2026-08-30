---
name: fairtask-baseline
description: Screen one SWE-bench-style task with fairtask's one-prompt baseline — the same rubric and material as the full pipeline but no repository access and no evidence verification — so its verdict can be compared with /fairtask on the same task. Use ONLY when a specific task is supplied (an instance id or task file) and the ask is to screen it with the baseline or compare the two screeners on it; for comparing the published evaluation numbers use fairtask-report or fairtask-score instead. Costs about fifteen cents and forty seconds per task; needs a Claude login or API key.
license: MIT
metadata:
  origin: fairtask
  repository: https://github.com/mnkprs/fairtask
---

# fairtask-baseline

Screen one candidate task with the **one-prompt baseline**: the same rubric, issue, gold patch and test patch the
full pipeline sees, but a single model call with no tools and no deterministic verification. The engine does not even clone the
task's repository for it — nothing is read beyond the task text.
Its purpose is comparison — run it next to `/fairtask` on the same task to show what the agent pipeline adds.

## Steps

1. **Identify the input**: a SWE-bench-style instance id (`--swebench <id> [--dataset …]`) or a task JSON
   (`--task <file>`), exactly as for `/fairtask`.
2. **Locate the engine** the same way `/fairtask` does: `$FAIRTASK_HOME` if set, else `~/.fairtask`, else the current
   directory if its `package.json` is named `fairtask`; if absent, clone
   `https://github.com/mnkprs/fairtask` with `--branch v0.1.1 --depth 1` into `~/.fairtask` and run `npm ci`.
3. **Run**: `npm run screen -- <input flags> --variant baseline`. Expect about forty seconds and fifteen cents.
4. **Report** the verdict in the same order as `/fairtask` (decision, both axes with reasons, every evidence item),
   and state plainly what the trailer says — **evidence not machine-verified — this variant has no verifier**: the
   baseline's quotes are whatever the model wrote — on the evaluation set eight to eleven percent of them do not exist where cited. That is the point of
   the comparison, not a malfunction.
5. If the same task was screened with `/fairtask`, put the two verdicts side by side: decision, per-axis scores,
   whether the evidence verified, cost.

## Gotchas

- Do not use a baseline verdict to accept or reject a task; it exists to be compared against.
- On the evaluation set the baseline agrees with expert humans 67% of the time — the same headline rate as the
  pipeline — so differences show up in the evidence and the per-axis scores, not usually in the decision.
