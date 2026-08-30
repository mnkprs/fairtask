---
name: fairtask-score
description: Score one or more fairtask runs against the human SWE-bench Verified labels and show the metrics side by side — decision accuracy, kappa, flag precision/recall, TPR/TNR, per-axis agreement, cost and time. Use when asked to score a run, compare runs, or check accuracy, recall or kappa of the fairtask evaluation. Offline, reads the committed results; no model calls.
license: MIT
metadata:
  origin: fairtask
  repository: https://github.com/mnkprs/fairtask
---

# fairtask-score

Metrics of fairtask runs against the human labels, straight from the scorer.

## Steps

1. **Locate the repository**: current directory if its `package.json` is named `fairtask`; else `$FAIRTASK_HOME`;
   else `~/.fairtask`. If none exists, say so and stop.
2. **Run**: `npm run score -- <run ids…>` — default `baseline v3-verify`; any directory names under `results/`
   (`baseline`, `baseline-rerun`, `v1-context`, `v2-specialists`, `v3-verify`, `v4-calibrated`, `v5-cheap-probes`,
   `v5-rerun`, `v6-target-aware`, `v7-sonnet-nocal`). Add `--detail` when asked for per-instance rows.
3. **Show the output verbatim** in a code block; do not round or reorder numbers.
4. Add one or two sentences: PRIMARY decision accuracy is the headline metric; TPR/TNR are over scored cases only;
   these are development-set numbers.
