---
description: Screen a SWE-bench-style task, task JSON, or pull request for fairness (under-specified issue / tests that only accept the original fix) and report a verdict with verified evidence.
argument-hint: <instance-id | task.json | owner/repo pr-number> [--variant v3-verify|v5-cheap-probes|v6-target-aware]
---

Use the **fairtask** skill on: $ARGUMENTS

Follow the skill's steps exactly: identify the input, locate or install the engine, run it, report every evidence
item with its location, and present the verdict as a recommendation for a human reviewer.
