---
name: fairtask-cases
description: Show fairtask's 30-case evaluation set (instances, strata, human scores) or lay out one instance — its issue text, test patch, gold patch and human labels — quoting the decisive lines with file and line numbers. Use when asked which cases the evaluation uses, to show the eval set, or to lay out / inspect a specific instance id. Offline except one pinned public download; no model calls.
license: MIT
metadata:
  origin: fairtask
  repository: https://github.com/mnkprs/fairtask
---

# fairtask-cases

The evaluation set, or one case laid out so a reader can see the discrepancy without opening files.

## Steps

1. **Locate the repository**: current directory if its `package.json` is named `fairtask`; else `$FAIRTASK_HOME`;
   else `~/.fairtask`. If none exists, say so and stop.
2. **No instance id given** — show the set: `npm run data:eval-set` (needs `data/raw/swebench_test.parquet`; if
   missing, first run `curl --fail -L -o data/raw/swebench_test.parquet https://huggingface.co/datasets/princeton-nlp/SWE-bench/resolve/e48e2bd1e9fecd5bbd641e9414ac59da9f2e69f6/data/test-00000-of-00001.parquet`
   and say you did). Show the 30-row table verbatim and name the four strata with their counts. In a clean checkout
   `git status` stays clean afterwards — if not, say so; that is a reproducibility failure.
3. **Instance id given** — lay it out: `npm run show -- <instance_id>`, then open
   `examples/<instance_id>/human-labels.md`, `issue.md` and `test.patch` yourself — do not paste the files. Show the
   one `wrote …` line, the human labels as one line (`underspecified=N, false_negative=N, difficulty, filter_out`),
   then the lines that decide the case, quoted exactly with `file:line` — what the issue asks for, and what the
   graded tests require that the issue does not say (the `+` lines of the FAIL_TO_PASS tests). Two to four quotes,
   no more; point to `examples/<instance_id>/` for the full text. Done when a reader can see the discrepancy (or its
   absence) without opening the files.
