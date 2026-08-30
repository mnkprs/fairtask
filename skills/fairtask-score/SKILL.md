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

1. **Locate the engine**, in order: the current directory if its `package.json` is named `fairtask`;
   `$CLAUDE_PLUGIN_ROOT` if set and it contains that `package.json` (the Claude Code plugin install *is* the
   repository); `$FAIRTASK_HOME`; `~/.fairtask`. If none exists, clone the pinned release —
   `git clone --branch v0.1.1 --depth 1 https://github.com/mnkprs/fairtask ~/.fairtask && (cd ~/.fairtask && npm ci)`
   — and say you did (needs network and Node ≥ 22.18).
2. **Run**: `npm run score -- <run ids…>` — default `baseline v3-verify`; any directory names under `results/`
   (`baseline`, `baseline-rerun`, `v1-context`, `v2-specialists`, `v3-verify`, `v4-calibrated`, `v5-cheap-probes`,
   `v5-rerun`, `v6-target-aware`, `v7-sonnet-nocal`). Add `--detail` when asked for per-instance rows.
3. **Show the output verbatim** in a code block; do not round or reorder numbers.
4. Add one or two sentences: PRIMARY decision accuracy is the headline metric; TPR/TNR are over scored cases only;
   these are development-set numbers.
