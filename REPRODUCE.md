# Reproduction guide

Everything below was run on macOS 15 (Apple Silicon) with the versions listed; nothing is platform-specific except
that the Claude Code CLI must be installable.

## 0. Requirements

| Component | Version used | Notes |
|---|---|---|
| Node.js | 24.18.0 | ≥ 22.6 works (runs `.ts` files directly, no build step) |
| npm | bundled with Node | |
| git | any recent | used to shallow-clone 30 repositories (~1.2 GB total on disk) |
| Claude Code CLI | 2.1.250 | `npm install -g @anthropic-ai/claude-code`; the Agent SDK drives it |
| `@anthropic-ai/claude-agent-sdk` | 0.3.250 | pinned in `package-lock.json` |
| Model | `claude-opus-5` | same model for the baseline and every agent variant |

**Authentication.** Either `export ANTHROPIC_API_KEY=...` or run `claude login` once. The SDK picks up whichever is
present. No other credentials are needed; the project never reads your `~/.claude` settings, MCP servers or CLAUDE.md
(`settingSources: []`, `strictMcpConfig: true`).

## 1. Install

```bash
git clone https://github.com/mnkprs/fairtask && cd fairtask
npm ci
npm run typecheck          # optional sanity check
npm test                   # adversarial tests for the evidence verifier
```

## 2. Data

Two public inputs, both already committed under `data/`:

- `data/raw/ensembled_annotations_public.csv` — OpenAI's human annotations for 1,699 SWE-bench test instances
  (three annotators per instance, ensembled by max severity). Published with *Introducing SWE-bench Verified* (Aug 2024).
- `data/eval/instances.json` — the fixed evaluation set: 30 instances (seed `20260828`), each with its issue text,
  gold patch, test patch, FAIL_TO_PASS list and the human labels. `data/eval/calibration.json` holds the annotator
  notes for the *other* 1,600+ instances, grouped by repository (used by the final variant; contains no eval instance).

To rebuild them from scratch (needs the 12 MB SWE-bench parquet, not committed):

```bash
curl -L -o data/raw/swebench_test.parquet \
  "https://huggingface.co/datasets/princeton-nlp/SWE-bench/resolve/main/data/test-00000-of-00001.parquet"
npm run data:eval-set        # -> data/eval/instances.json  (prints the 30 instances and strata)
npm run data:calibration     # -> data/eval/calibration.json
```

The repositories at each instance's base commit (what the agents inspect):

```bash
npm run data:workspaces      # shallow-clones 30 repos into workspaces/<instance_id>/repo — ~20 s on a fast link
```

## 3. Screen a single task (the product)

```bash
npm run screen -- --swebench django__django-11099            # any SWE-bench-style instance from Hugging Face
npm run screen -- --task path/to/task.json                    # your own task; format in README §2b
```

Expect ~3 minutes and ~$1 (list price) per task; output in `screenings/<instance_id>/`.

## 4. Run the baseline and the solution over the evaluation set

```bash
npm run run -- --variant baseline  --run-id baseline    # one prompt, no tools
npm run run -- --variant v3-verify --run-id v3-verify   # final solution (default configuration)
```

The other changelog rows, if you want to reproduce the whole curve (each is one command; the cost option is
`v5-cheap-probes`/`v7-sonnet-nocal`, the high-recall option is `v6-target-aware`):

```bash
for v in v1-context v2-specialists v4-calibrated v5-cheap-probes v6-target-aware v7-sonnet-nocal; do
  npm run run -- --variant $v --run-id $v
done
npm run run -- --variant baseline        --run-id baseline-rerun   # repeat runs used for the noise estimate
npm run run -- --variant v5-cheap-probes --run-id v5-rerun
```

Useful flags: `--only <id,id>` to run a subset, `--concurrency 3` (default), `--force` to discard a previous
run with the same id (runs are otherwise resumable: finished instances are skipped), `--retry-errors` to re-run
instances that errored last time, `--model <id>` to try another model.

**If you run on a Claude subscription rather than an API key:** eight concurrent Opus agent sessions exhausted a
5-hour usage window twice during development. The runner detects the "session limit" error and stops the whole run
immediately (exit code 3) instead of failing every remaining instance; when the window resets, re-run the same
command with `--retry-errors` and it continues from where it stopped. Keep total concurrency around 4–5 sessions.

Outputs per run: `results/<run-id>/predictions.jsonl` (one verdict per instance with cost/turns/tokens) and
`trajectories/<run-id>/<instance_id>.jsonl` (every tool call, tool result, subagent report, verification failure and
retry). Render a trajectory as Markdown with `npm run trajectory -- trajectories/<run-id>/<instance_id>.jsonl`, or all
of them with `scripts/render-trajectories.sh <run-id>`.

## 5. Evaluate

`npm run score` needs only the committed results. `evidence-audit`, `code-check` and `finalize-report.py` re-read the
repositories at the base commit, so run `npm run data:workspaces` first (they refuse to run otherwise).

```bash
npm run score -- baseline baseline-rerun v1-context v2-specialists v3-verify v4-calibrated v5-cheap-probes v5-rerun v6-target-aware v7-sonnet-nocal
npm run score -- baseline v3-verify --detail          # per-instance rows
node src/evidence-audit.ts baseline v3-verify         # share of cited evidence that does not check out
npm run code-check                                    # zero-LLM pre-check for gold-patch-only identifiers (TPR/TNR vs humans)
scripts/finalize-report.py v3-verify baseline baseline-rerun v1-context v2-specialists v3-verify v4-calibrated v5-cheap-probes v5-rerun v6-target-aware v7-sonnet-nocal   # regenerates the README/REPRODUCE tables
```

The scorer compares every verdict with the human labels and prints the comparison table used in the README; it also
writes `results/<run-id>/summary.json`. The primary metric is **decision accuracy**: does the system's
usable/flag decision match the humans' (usable ⇔ both scores ≤ 1)?

## 6. Expected runtime and cost

| Run | Cases | Mean time / case | Mean cost / case | Total cost (list) | Wall-clock for the set |
|---|---|---|---|---|---|
| `baseline` | 30 | 41 s | $0.14 | $4 | ~7 min at concurrency 3 |
| `baseline-rerun` | 30 | 42 s | $0.13 | $4 | ~7 min at concurrency 3 |
| `v1-context` | 30 | 62 s | $0.25 | $8 | ~10 min at concurrency 3 |
| `v2-specialists` | 30 | 176 s | $0.92 | $27 | ~29 min at concurrency 3 |
| `v3-verify` | 30 | 186 s | $0.95 | $29 | ~31 min at concurrency 3 |
| `v4-calibrated` | 30 | 181 s | $0.93 | $28 | ~30 min at concurrency 3 |
| `v5-cheap-probes` | 30 | 184 s | $0.55 | $16 | ~31 min at concurrency 3 |
| `v5-rerun` | 30 | 171 s | $0.57 | $17 | ~28 min at concurrency 3 |
| `v6-target-aware` | 30 | 170 s | $0.88 | $26 | ~28 min at concurrency 3 |
| `v7-sonnet-nocal` | 30 | 200 s | $0.60 | $18 | ~33 min at concurrency 3 |

Measured on the runs reported in the README (Claude Opus 5; `v5`/`v7` use Sonnet 5 for the two probes). Reproducing baseline + final costs about $33 at list price and ~45 minutes at concurrency 3; the whole curve about $200 and ~5 hours. Workspace cloning adds ~20 s once.

Costs are the list-price USD reported by the SDK (`total_cost_usd`); on a Claude subscription they count against
your usage allowance instead. Runs are resumable, so an interrupted run can simply be started again.
