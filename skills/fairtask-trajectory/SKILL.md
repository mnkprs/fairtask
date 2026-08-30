---
name: fairtask-trajectory
description: Render and walk through what a fairtask agent actually did on one instance — instructions, every tool call and result, the probe reports, verification and verdict — from the recorded trajectory of an evaluation run or a screening. Use when asked what the agent did, to show a trajectory, tool calls, probe reports or verification for an instance. Offline; no model calls.
license: MIT
metadata:
  origin: fairtask
  repository: https://github.com/mnkprs/fairtask
---

# fairtask-trajectory

One agent run, readable top to bottom.

## Steps

1. **Locate the engine**, in order: the current directory if its `package.json` is named `fairtask`;
   `$CLAUDE_PLUGIN_ROOT` if set and it contains that `package.json` (the Claude Code plugin install *is* the
   repository); `$FAIRTASK_HOME`; `~/.fairtask`. If none exists, clone the pinned release —
   `git clone --branch v0.1.1 --depth 1 https://github.com/mnkprs/fairtask ~/.fairtask && (cd ~/.fairtask && npm ci)`
   — and say you did (needs network and Node ≥ 22.18).
2. **Find the trajectory**: evaluation runs live at `trajectories/<run>/<instance_id>.jsonl` (default run
   `v3-verify`; the run ids are the directory names); single-task screenings at `screenings/<instance_id>/trajectory.jsonl`
   or `examples/<instance_id>/trajectory.jsonl`.
3. **Render**: `npm run trajectory -- <path to the .jsonl>`, then open the rendered `.md` next to it.
4. **Walk it in order**: agent instructions → the dispatches → the probes' tool calls and what came back → the
   probe reports with their evidence → the judge's spot-check → the verdict JSON → the verification result
   (including any `Verification failed` feedback and the corrective turn). Quote sparingly; give line numbers so
   the reader can jump.
