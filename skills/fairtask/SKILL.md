---
name: fairtask
description: Screen a SWE-bench-style coding task — a GitHub issue plus the PR that fixed it — for the two defects that make it unfair to grade an agent on (an under-specified issue; tests that only accept the original author's fix). Use when asked whether a task, PR or benchmark instance is fair, valid, well-specified or solvable; when building or auditing a benchmark, SWE-bench dataset or RL coding environment; or when a pull request should be checked before it becomes a task. Accepts a SWE-bench instance id, a task JSON file, or a PR of a repository.
license: MIT
metadata:
  origin: fairtask
  repository: https://github.com/mnkprs/fairtask
---

# fairtask

Decide whether a candidate task is **usable** or should be **flagged**, with evidence a human can check. A task is
usable only if both scores are ≤ 1:

- **underspecified** (0–3): could an engineer with the code but no way to ask questions build the fix from the issue text?
- **false_negative** (0–3): would the graded tests (FAIL_TO_PASS) accept every reasonable fix, or only the gold patch's own names, messages and choices?

The engine is the `fairtask` repository (github.com/mnkprs/fairtask): a judge agent, two specialist probes with
read-only access to the repository at the base commit, and a deterministic verifier that checks every quoted line.
This skill drives it, and falls back to doing the probes' work yourself when the engine cannot run.

## Steps

1. **Identify the input** — one of:
   - a SWE-bench-style instance id such as `django__django-11099` (`--swebench <id> [--dataset princeton-nlp/SWE-bench]`);
   - a task JSON with `repo`, `base_commit`, `problem_statement`, `patch`, `test_patch`, `FAIL_TO_PASS` (`--task <file>`);
   - a pull request: run `scripts/task-from-pr.sh <owner/repo> <number> > task.json` (needs `gh`). It fails closed
     (exit 3) when the PR has no linked issue, no test files, or no FAIL_TO_PASS selector confirmable against the added
     tests; report the reasons it prints and stop, unless the user explicitly accepts a provisional screening — then
     re-run with `--lenient` and pass `--allow-unconfirmed` to `npm run screen`, and say in the report that the
     test-axis score is provisional. Read the issue text back to the user for a one-line confirmation before
     screening, and surface any `_warning` the JSON carries.
2. **Locate the engine.** Use `FAIRTASK_HOME` if set, else `~/.fairtask`. If absent, install the release this skill
   was published with — never a moving branch:
   `git clone --branch v0.1.1 --depth 1 https://github.com/mnkprs/fairtask ~/.fairtask && (cd ~/.fairtask && npm ci)`.
   If it exists, confirm it is at that release (`git -C ~/.fairtask describe --tags`) before using it; otherwise
   re-clone. This step writes under the home directory, installs npm packages and runs code; say so if the user has
   not seen the engine installed before. Requirements: Node ≥ 22.18, git, and either `ANTHROPIC_API_KEY` or a
   `claude login`. If any is missing and cannot be installed, go to **Manual mode**.
3. **Run** from the engine directory: `npm run screen -- <input flags> [--variant v3-verify]`. Expect about three minutes and
   about one US dollar per task at list price (`--variant v5-cheap-probes` ≈ 55 cents). The result is `screenings/<instance_id>/verdict.json`
   and the trajectory next to it. If the run stops with a session/usage-limit error, say so and stop — do not retry in a loop.
4. **Report** from `verdict.json`, in this order: decision (USABLE / FLAG); each axis as `score — one-sentence reason`;
   then every evidence item as `[axis] location — quote`. Add whether the evidence was verified (`verified: true`)
   and the cost. Close with what the reader should do: for FLAG, open the cited lines and decide; for USABLE, nothing.
   Done when every evidence item in the file appears in the report with its location.
5. **Interpret honestly.** The pipeline agrees with expert human decisions about as often as a one-prompt baseline
   (67% on the evaluation set); what it adds is verified evidence and recall. Present the verdict as a
   recommendation, never as ground truth, and say so when the reader is about to drop a task on its strength.

## Manual mode

When the engine cannot run, perform the screening yourself with the repository checked out at the base commit,
following [`references/method.md`](references/method.md): the rubric, the spec-probe and test-probe procedures,
the evidence rule (verbatim quotes with `path:Lstart-Lend`), and the verdict format. Then re-open every location you
cited and confirm the quote is there; drop any evidence you cannot confirm and lower the score it supported.
State in the report that the verdict came from manual mode and that quotes were self-checked, not machine-verified.

## Gotchas

- Only FAIL_TO_PASS tests are graded. A test the PR added that already passes before the fix constrains no solver,
  however strict it looks; do not flag a task for it.
- A name the tests require that the issue never states is the canonical false_negative — but not when the
  repository's own conventions make it the only natural choice. Grep for sibling APIs before scoring it a 2.
- The engine's guard confines the agents to the task's repository; give it a task, never a path outside one.
