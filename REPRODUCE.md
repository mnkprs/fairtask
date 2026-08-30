# Reproduction guide

Written for a clean machine: nothing is assumed beyond the requirements in §0. Everything below was run on macOS 15 (Apple Silicon) with the versions listed; nothing is platform-specific except
that the Claude Code CLI must be installable.

## 0. Requirements

| Component | Version used | Notes |
|---|---|---|
| Node.js | 24.18.0 | ≥ 22.18 works (runs `.ts` files directly, no build step); CI uses 24 |
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
npm test                   # 23 adversarial tests: verifier, workspace trust, run lock / concurrency
npm run validate:manifests # semantic check of the plugin manifests and the skill
```

## 2. Data

Two public inputs, both already committed under `data/`:

- `data/raw/ensembled_annotations_public.csv` — OpenAI's human annotations for 1,699 SWE-bench test instances
  (three annotators per instance, ensembled by max severity), published with *Introducing SWE-bench Verified* (Aug 2024).
  Provenance and checksum: `data/raw/SOURCES.md`. `npm run data:annotations -- --check` verifies the committed copy;
  `npm run data:annotations` re-downloads it from the pinned source commit and refuses a mismatching file.
- `data/eval/instances.json` — the fixed evaluation set: 30 instances (seed `20260828`), each with its issue text,
  gold patch, test patch, FAIL_TO_PASS list and the human labels. `data/eval/calibration.json` holds the annotator
  notes for the *other* 1,600+ instances, grouped by repository (used only by the `v4`–`v6` experimental configurations, not by the `v3-verify` default; contains no eval instance).

To rebuild them from scratch (needs the 12 MB SWE-bench parquet, not committed):

```bash
curl --fail -L -o data/raw/swebench_test.parquet \
  "https://huggingface.co/datasets/princeton-nlp/SWE-bench/resolve/e48e2bd1e9fecd5bbd641e9414ac59da9f2e69f6/data/test-00000-of-00001.parquet"
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
npm run screen -- --task path/to/task.json                    # your own task; format in README §2a
```

Expect ~3 minutes and ~$1 (list price) per task; output in `screenings/<instance_id>/`.

What to expect on the terminal (this is the committed run `examples/psf__requests-2317/`; the head lines name the
task, the variant, the model and the cloned workspace, then the verdict):

```
fairtask · psf__requests-2317 · v5-cheap-probes · claude-opus-5
repository psf/requests @ 091991be0d (cloned) → workspaces/psf__requests-2317/repo
────────────────────────────────────────────────────────────────────────
USABLE   underspecified=0  false_negative=1  confidence=4/5  (evidence verified)
…
$0.49 · 195s · 8 turns
written: screenings/psf__requests-2317/verdict.json  (trajectory: screenings/psf__requests-2317/trajectory.jsonl; …)
```

A verdict whose evidence still fails verification after two corrective turns is not written as a result: `screen`
prints `NO VERDICT` and exits 1. From inside an agent instead of a shell: `npx skills add mnkprs/fairtask`, then
`/fairtask <instance-id | task.json | owner/repo PR#>` (README §2b).

## 4. Run the baseline and the solution over the evaluation set

```bash
npm run run -- --variant baseline  --run-id baseline-repro    # one prompt, no tools
npm run run -- --variant v3-verify --run-id v3-verify-repro   # final solution (default configuration)
npm run score -- baseline baseline-repro v3-verify v3-verify-repro   # your runs next to the committed ones
```

The other changelog rows, if you want to reproduce the whole curve (each is one command; the cost option is
`v5-cheap-probes`/`v7-sonnet-nocal`, the high-recall option is `v6-target-aware`):

```bash
for v in v1-context v2-specialists v4-calibrated v5-cheap-probes v6-target-aware v7-sonnet-nocal; do
  npm run run -- --variant $v --run-id $v-repro
done
```

The committed run ids (`baseline`, `v3-verify`, …) are already complete, so a run with one of those ids does nothing —
use a new `--run-id` as above, or `--force` to overwrite. Other flags: `--only <id,id>` to run a subset,
`--concurrency 3` (default), `--retry-errors` to re-run instances that errored last time (runs are resumable),
`--model <id>` to try another model. A run id records a fingerprint of its configuration and refuses to be resumed
with a different one.

**If you run on a Claude subscription rather than an API key:** eight concurrent Opus agent sessions exhausted a
5-hour usage window twice during development. The runner detects the "session limit" error and stops the whole run
immediately (exit code 3) instead of failing every remaining instance; when the window resets, re-run the same
command with `--retry-errors` and it continues from where it stopped. Keep total concurrency around 4–5 sessions.

Outputs per run: `results/<run-id>/predictions.jsonl` (one verdict per instance with cost/turns/tokens) and
`trajectories/<run-id>/<instance_id>.jsonl` (every tool call, tool result, subagent report, verification failure and
retry). Render a trajectory as Markdown with `npm run trajectory -- trajectories/<run-id>/<instance_id>.jsonl`, or all
of them with `scripts/render-trajectories.sh <run-id>`.

## 5. Evaluate

`npm run score` needs only the committed results. `report.ts`, `evidence-audit`, `code-check` and `finalize-report.py`
re-read the repositories at the base commit, so run `npm run data:workspaces` first (they refuse to run otherwise).

```bash
npm run score -- baseline baseline-rerun v1-context v2-specialists v3-verify v4-calibrated v5-cheap-probes v5-rerun v6-target-aware v7-sonnet-nocal
npm run score -- baseline v3-verify --detail          # per-instance rows
node src/evidence-audit.ts baseline v3-verify         # share of cited evidence that does not check out
npm run code-check                                    # zero-LLM pre-check for gold-patch-only identifiers (TPR/TNR vs humans)
scripts/finalize-report.py v3-verify baseline baseline-rerun v1-context v2-specialists v3-verify v4-calibrated v5-cheap-probes v5-rerun v6-target-aware v7-sonnet-nocal   # regenerates the README/REPRODUCE tables
```

The scorer compares every verdict with the human labels and prints the comparison table used in the README; it also
writes `results/<run-id>/summary.json`. The primary metric is **decision accuracy**: does the system's
usable/flag decision match the humans' (usable ⇔ both scores ≤ 1)? The first lines of `npm run score -- baseline v3-verify`
on the committed results:

```
                                        baseline     v3-verify
--------------------------------------------------------------
instances scored / expected                30/30         30/30
verdicts failing verification                  0             0
PRIMARY decision accuracy                    67%           67%
balanced accuracy                            65%           63%
Cohen's kappa vs humans                     0.29          0.25
flag precision / recall                  78%/70%       75%/75%
```

A reproduction run lands within ±2 cases of these (the baseline repeated at 67%/67%; agent variants at 60–70%
across eight runs, see README §4). Representative trajectories, including the two runs where the verifier sent
feedback and the judge corrected its evidence, are listed in README §2d.

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
