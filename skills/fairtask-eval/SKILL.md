---
name: fairtask-eval
description: Reproduce, inspect or explain the fairtask evaluation from inside an agent session — build the 30-case evaluation set, score runs against the human labels, regenerate the comparison report, audit cited evidence, run the zero-LLM pre-check, verify the data provenance, or lay out one evaluation instance as readable files. Use when asked to show, rerun, check or explain the evaluation numbers, the eval set, a run's results, or a specific evaluation instance of the fairtask project. Read-only and offline except for the data fetch; makes no model calls.
license: MIT
metadata:
  origin: fairtask
  repository: https://github.com/mnkprs/fairtask
---

# fairtask-eval

Run the evaluation tooling of the `fairtask` repository and bring its output into the conversation, so the numbers a
reader sees come from the scripts, never from memory. Every operation is offline (the scorer reads committed results)
except `data` and `annotations`, which download pinned public files. None calls a model.

## Steps

1. **Locate the repository.** The current directory if its `package.json` is named `fairtask`; else `FAIRTASK_HOME`; else
   `~/.fairtask`. If none exists, say so and stop — this skill does not clone.
2. **Pick the operation** from the request (one per invocation; ask if two are equally plausible):

   | Request mentions | Run from the repository root |
   |---|---|
   | the evaluation set, the thirty cases, strata, which tasks | `npm run data:eval-set` (needs `data/raw/swebench_test.parquet`; if missing, run `curl -L -o data/raw/swebench_test.parquet https://huggingface.co/datasets/princeton-nlp/SWE-bench/resolve/main/data/test-00000-of-00001.parquet` first and say you did) |
   | score, accuracy, kappa, recall, a run id, compare runs | `npm run score -- <run ids…>` (default: `baseline v3-verify`; add `--detail` for per-instance rows) |
   | the report, the headline table, baseline versus final | `node src/report.ts --baseline baseline --final v3-verify --final-repeat v5-rerun --runs <all run ids>` — the run ids are the directory names under `results/` |
   | evidence audit, bad evidence, fabricated quotes | `npm run audit -- <run ids…>` (needs cloned workspaces: `npm run data:workspaces` first, ~20 s) |
   | code check, novel identifiers, pre-check | `npm run code-check` (needs workspaces) |
   | provenance, annotations, checksum, data source | `npm run data:annotations -- --check` |
   | show an instance, lay out, issue text, test patch of `<id>` | `npm run show -- <instance_id>` then read back `examples/<instance_id>/issue.md`, `test.patch`, `human-labels.md` |
   | trajectory, what the agent did on `<id>` in run `<run>` | `npm run trajectory -- trajectories/<run>/<instance_id>.jsonl` and open the rendered `.md` |

3. **Show the output verbatim** in a code block. Do not round, reorder or summarise numbers before the block.
4. **Add one or two sentences** on how to read it — which row is the primary metric (decision accuracy), that
   TPR/TNR are over scored cases only, that "bad evidence" is the share of cited quotes not found where cited. For the
   evaluation set, name the four strata and the count per stratum. Stop there; the reader asked for the artifact, not
   an essay.

## Gotchas

- Committed run ids are complete: `npm run run -- --run-id baseline` does nothing. Reproduction runs use fresh ids
  (`baseline-repro`), cost money and need `claude login` or `ANTHROPIC_API_KEY`; this skill does not start them.
  Point the user at `REPRODUCE.md` instead.
- `audit`, `code-check` and `finalize-report.py` refuse to run without workspaces at the right commits; that is
  intended. Run `npm run data:workspaces`, do not work around it.
- `data:eval-set` prints the table; it also rewrites `data/eval/instances.json` deterministically. In a clean checkout
  `git status` stays clean afterwards — if it does not, say so, because that is a reproducibility failure.
