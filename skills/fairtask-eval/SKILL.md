---
name: fairtask-eval
description: Inspect the fairtask evaluation's supporting checks from inside an agent session — audit cited evidence against the repositories, run the zero-LLM code pre-check, or verify the annotation data's provenance and checksum — and route anything else to the dedicated commands (/fairtask-report, /fairtask-score, /fairtask-cases, /fairtask-trajectory). Use when asked to audit evidence, run the code check, verify data provenance, or when unsure which fairtask command fits. Read-only and offline; makes no model calls.
license: MIT
metadata:
  origin: fairtask
  repository: https://github.com/mnkprs/fairtask
---

# fairtask-eval

Run the evaluation tooling of the `fairtask` repository and bring its output into the conversation, so the numbers a
reader sees come from the scripts, never from memory. The dedicated commands cover the common asks; this skill keeps
the supporting checks (evidence audit, code pre-check, provenance) and routes everything else. All offline; none
calls a model.

## Steps

1. **Locate the repository.** The current directory if its `package.json` is named `fairtask`; else `FAIRTASK_HOME`; else
   `~/.fairtask`. If none exists, say so and stop — this skill does not clone.
2. **Pick the operation** from the request (one per invocation; ask if two are equally plausible):

   | Request mentions | Do |
   |---|---|
   | evidence audit, bad evidence, fabricated quotes | `npm run audit -- <run ids…>` (needs cloned workspaces: `npm run data:workspaces` first, ~20 s) |
   | code check, novel identifiers, pre-check | `npm run code-check` (needs workspaces) |
   | provenance, annotations, checksum, data source | `npm run data:annotations -- --check` |
   | the report, headline table, baseline versus final | use `/fairtask-report` |
   | score, accuracy, kappa, a run id, compare runs | use `/fairtask-score` |
   | the evaluation set, the thirty cases, lay out an instance | use `/fairtask-cases` |
   | trajectory, what the agent did | use `/fairtask-trajectory` |
   | screen a task | use `/fairtask` (full pipeline) or `/fairtask-baseline` (one-prompt control) |

3. **Show the output verbatim** in a code block. Do not round, reorder or summarise numbers before the block.
4. **Add one or two sentences** on how to read it — which row is the primary metric (decision accuracy), that
   TPR/TNR are over scored cases only, that "bad evidence" is the share of cited quotes not found where cited. For the
   evaluation set, name the four strata and the count per stratum. Stop there; the reader asked for the artifact, not
   an essay.

## Gotchas

- Committed run ids are complete: `npm run run -- --run-id baseline` does nothing. Reproduction runs use fresh ids
  (`baseline-repro`), cost money and need `claude login` or `ANTHROPIC_API_KEY`; this skill does not start them.
  Point the user at `REPRODUCE.md` instead.
- `report.ts`, `audit`, `code-check` and `finalize-report.py` refuse to run without workspaces at the right commits;
  that is intended. Run `npm run data:workspaces`, do not work around it.
- `data:eval-set` prints the table; it also rewrites `data/eval/instances.json` deterministically. In a clean checkout
  `git status` stays clean afterwards — if it does not, say so, because that is a reproducibility failure.
