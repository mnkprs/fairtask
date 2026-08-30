<h1 align="center">fairtask</h1>

<p align="center"><strong>Is this SWE-bench-style task fair enough to grade an agent on?</strong><br>
<sub>Agentic screening with verified evidence, measured against human annotations · micro1 Agentic Workflows Hackathon, August 2026</sub></p>

<p align="center">
  <a href="https://github.com/mnkprs/fairtask/actions/workflows/ci.yml"><img alt="ci" src="https://img.shields.io/github/actions/workflow/status/mnkprs/fairtask/ci.yml?branch=main&label=ci"></a>
  <a href="https://github.com/mnkprs/fairtask/releases/tag/v0.1.0"><img alt="release" src="https://img.shields.io/github/v/release/mnkprs/fairtask?label=submission"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <a href="https://skills.sh/mnkprs/fairtask/fairtask"><img alt="skill" src="https://img.shields.io/badge/agent%20skill-%2Ffairtask-0F766E"></a>
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A5%2022.18-339933">
</p>

> **Scope.** Coding only, and one task shape only: *GitHub issue + repository at the pre-fix commit + hidden tests from
> the fixing PR* — SWE-bench and its descendants (Verified, Multimodal, Multilingual, Pro, SWE-rebench, SWE-Gym/SWE-smith-style
> RL tasks), in any language. "Fair" means two technical properties of such a task — the issue is specified well enough
> to build from, and the graded tests accept every reasonable fix — not fairness in an ethical sense, and not difficulty,
> contamination, flakiness, cost, or anything about the agents the benchmark grades. Function-synthesis, terminal, web,
> math or financial benchmarks are out of scope.

`fairtask` screens candidate software-engineering benchmark tasks — a GitHub issue, the repository at the pre-fix
commit, and the hidden tests from the fixing PR — for the two defects that make such a task grade solvers unfairly:

1. **Under-specified issue** — the issue text is too vague for an engineer to know what to build without asking.
2. **Over-narrow tests** — the tests only accept the original PR's particular choices (a parameter name, an error
   message, a helper introduced by the gold patch) that the issue never mentions, so reasonable fixes fail.

It is a Claude Agent SDK pipeline (TypeScript) that reads the actual repository, dispatches two specialist probes,
verifies every piece of evidence they cite against the code, and returns a scored verdict with quotes a reviewer can
check. Its output is measured against **OpenAI's public human annotations** for the same tasks.

**Result on 30 human-annotated cases (same cases and same deciding model for every system — a development set: these same 30 cases were used to diagnose failures and design every iteration, and there is no held-out evaluation):** on the headline
metric — agreement with the human usable/flag decision — the agent pipeline **does not reliably beat the one-prompt
baseline**: the baseline scores 67% on two independent runs, the agent variants 60–70% with a ±2-case run-to-run
spread. What the agent changes is measurable elsewhere: the evidence it cites is **verifiable 100% of the time**
(baseline: 8–11% of cited quotes do not exist where claimed), recall of human-flagged tasks rises from 70% to
75–85% depending on configuration, and the cost option (probes on Sonnet 5) does this at **$0.55 per task** with the same decisions within noise. Five of the
thirty cases are wrong for *every* system built here, and §6 shows with checkable examples that they trace to the
labels, not the agent — which is the report's main finding.

## Quick start

```bash
# Node ≥ 22.18 (24 recommended), then `claude login` or export ANTHROPIC_API_KEY=…
git clone https://github.com/mnkprs/fairtask && cd fairtask && npm ci

# screen any SWE-bench task by its instance id (~3 min, ~$1 at list price). Nothing to download first:
# the command fetches the task from Hugging Face and shallow-clones the repository at the right commit.
npm run screen -- --swebench django__django-11099

# screen your own task (JSON format in §2a)
npm run screen -- --task my-task.json

# or use it from inside your agent:  /fairtask <id | task.json | owner/repo PR#>
npx skills add mnkprs/fairtask
```

The `--` after `npm run <script>` is npm's separator: everything after it goes to the script, not to npm.
`django__django-11099` is a **SWE-bench instance id**, `<owner>__<repo>-<pull request number>`: the task built from
Django pull request #11099. Full command reference: [§2c](#2c-command-reference).

## Where to go

| I want to… | Read |
|---|---|
| Screen my own tasks from a shell | [§2a · Use it from a shell](#2a-use-it-from-a-shell) |
| Use it from inside an agent (the agentic interface) | [§2b · Use it from inside your agent](#2b-use-it-from-inside-your-agent) |
| Look up a command and its flags | [§2c · Command reference](#2c-command-reference) |
| Follow what each agent did, tool by tool, including retries | [§2d · Agent trajectories](#2d-agent-trajectories) |
| Reproduce every number from a clean machine | [REPRODUCE.md](REPRODUCE.md) |
| Understand the problem and who has it | [§1 · Who has this problem](#1-who-has-this-problem-and-what-is-the-bottleneck) |
| See how the pipeline works | [§2 · What the solution does](#2-what-the-solution-does) |
| Check how it was evaluated | [§3 · Evaluation design](#3-evaluation-design) · [§4 · Results](#4-results) |
| Follow what was tried, kept and removed | [§5 · Improvement changelog](#5-improvement-changelog) |
| Read the main finding | [§6 · Failure mode and hot take](#6-main-failure-mode-and-the-hot-take) |
| See what outside review changed | [§6b · Code review](#6b-adversarial-review-and-what-changed-because-of-it) · [§6c · Eval audit](#6c-evaluation-methodology-audit-evals-skills-eval-audit) |
| Find a file | [§9 · Layout](#9-layout) |

---

## 1. Who has this problem, and what is the bottleneck?

**How these tasks are made.** SWE-bench (Jimenez et al., ICLR 2024) builds tasks with a three-stage pipeline: scrape
~90,000 pull requests from 12 Python repositories; keep the merged PRs that resolve an issue *and* touch test files;
keep those that install and have at least one test that flips from failing to passing. 2,294 tasks survive. Every
successor — SWE-bench Multimodal and Multilingual, SWE-Gym, SWE-smith, SWE-rebench — is a variation of that
pipeline. What the pipeline checks is *executability*. It cannot check the two things that make a task fair to grade:

1. **Is the issue text specified well enough** that an engineer could write the fix without asking questions?
2. **Do the tests accept every reasonable fix**, or only the particular choices the original PR made — a parameter
   name, an error message, a helper the gold patch introduced — that the issue never mentions?

**Where the field is in 2026.** Those two questions turned out to decide whether a benchmark means anything:

- In August 2024 OpenAI had 93 professional engineers annotate 1,699 SWE-bench tasks, three times each, on exactly
  these two questions, and kept the 500 that passed as **SWE-bench Verified**. 68% were filtered out — 38% for an
  under-specified issue, 61% for tests that would reject reasonable solutions. The public annotation file is
  committed as `data/raw/ensembled_annotations_public.csv`; its provenance (publisher, pinned mirror commit, SHA-256,
  what CI re-verifies) is in [`data/raw/SOURCES.md`](data/raw/SOURCES.md).
- In February 2026 OpenAI **stopped reporting SWE-bench Verified**. Auditing the 138 hardest problems (the 27.6%
  of the set its o3 runs could not consistently solve), with at least six engineers per case, they found **material
  issues in test design and/or problem description in 59.4%** of them — 35.5% *narrow* tests that enforce
  implementation details and reject functionally correct submissions, 18.8% *wide* tests that demand functionality
  the issue never specified, 5.1% miscellaneous — on top of training contamination
  ([OpenAI, 2026](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)). Their taxonomy is this
  report's two axes: tests mis-scoped for the issue, and issues that under-specify. They recommend SWE-bench Pro,
  new uncontaminated private benchmarks, and expert grading.
- The successors institutionalised the screening step. **SWE-bench Pro** (Scale AI) adds three human-in-the-loop
  checkpoints: environment construction, human rewriting of under-specified issues into requirements, and human
  verification of the tests ([Scale AI](https://scale.com/blog/swe-bench-pro)). **SWE-rebench V2** (ICML 2026;
  32,079 tasks in 20 languages, plus 120,000 more with fail-to-pass tests) goes the other way: it "filters unsound
  instances using an ensemble of LLM judges, validated against human-verified SWE-bench annotations" and ships
  "instance-level metadata that flags common confounders such as overly restrictive tests and underspecified
  descriptions" ([arXiv 2602.23866](https://arxiv.org/abs/2602.23866)).

**User and bottleneck.** The user is anyone turning scraped issue+PR pairs into tasks in 2026: benchmark
maintainers, the RL-environment teams generating tens of thousands of training tasks, and the evaluation engineers
who decide which tasks to trust when they compare coding agents. The bottleneck is the screening pass between
"executable" and "fair". Today it is done in one of two ways: **expensive** — expert review, which even at
three annotators per task left material issues in 59% of the hard subset — or **shallow** — an ensemble of LLM judges that
reads the issue and diff but not the repository, and returns a score without evidence. Neither gives a reviewer
something to check. An unscreened task is worse than a missing one: it penalises solvers for guessing a name wrong,
which corrupts rankings and, in RL, rewards the wrong behaviour.

**What fairtask adds** is the missing middle: an agent that reads the actual repository at the base commit,
answers the two questions separately, and returns a verdict whose every quoted line is verified against the code —
so a human reviewer adjudicates flagged tasks from the evidence instead of re-reading everything. It is evaluated
against the only public human labels that exist for these two questions, the 2024 Verified annotations — with the
caveat, now confirmed by OpenAI's own audit and by §6 of this report, that those labels are themselves imperfect.

**Why an agent, not a prompt?** The judgement depends on the codebase: whether `mask_invalid` is "the obvious name"
depends on whether the repository already uses that convention; whether an issue is ambiguous depends on whether the
surrounding code resolves the ambiguity. The baseline below — a single prompt, which is essentially what an
LLM-judge ensemble does — shows how far that gets without looking.

---

## 2. What the solution does

```
candidate task ──► judge agent (Opus 5)
                     │  dispatches, in parallel (Opus 5 by default; Sonnet 5 as the cost option):
                     ├──► spec-probe  (read-only repo tools)  → underspecified 0-3 + cited evidence
                     ├──► test-probe  (read-only repo tools)  → false_negative 0-3 + cited evidence
                     │  spot-checks the strongest claim of each with its own Read/Grep
                     ▼
                   structured verdict (JSON schema enforced)
                     │
                     ▼
            deterministic verifier (no LLM): every quote must exist where it is cited
            (file at base commit / test patch / gold patch / issue); scores ≥ 2 need
            verified evidence; inconsistent decisions rejected
                     │ failures fed back as a new turn (≤ 2 retries)
                     ▼
        usable / flag + rationale + evidence a human reviewer can click through
```

The pieces, and why each exists (each is one row of the changelog in §5):

| Piece | Kind of capability | What it fixes |
|---|---|---|
| Read-only tools on the checked-out repo (`Read`, `Grep`, `Glob`), cwd = repo root | context / tools | The baseline scores from the diff alone and cannot tell a convention-following name from an invented one. |
| Two specialist subagents, one per axis, each with its own method | orchestration / skills | One agent asked two different questions blurs them; the axis rubrics need different investigation procedures (§`src/variants/v2-specialists.ts`). |
| Judge spot-checks the probes before deciding | verification (in-agent) | Probes overstate; the judge opens the cited location before accepting a 2 or 3. |
| Deterministic evidence verifier with feedback retries | verification (outside the model) | Quotes that are not verbatim, files that do not exist at the base commit, scores with no evidence. The model gets the list of failures and must fix them. |
| ~~Per-repository calibration memory from human annotations~~ (tried in v4–v6, **not in the default**) | memory / context | Meant to anchor the 0–3 thresholds with how humans scored other issues in the same repository (leakage-checked). No reliable effect in either direction across four runs — see the changelog. Kept in the code as an option. |
| JSON-schema-enforced output (`outputFormat`) | engineering | The verdict is machine-checkable; a malformed answer is retried by the SDK, not parsed heuristically. |
| Hook that denies any subagent except the two declared probes; `strictMcpConfig`; `settingSources: []` | control / reproducibility | The run only sees what the code declares — no user MCP servers, no CLAUDE.md, no built-in subagents. |

All agent instructions live in `src/variants/*.ts` and `src/lib/rubric.ts`; every trajectory embeds the exact
instructions it ran with.

**Human-in-the-loop by design.** The output is a recommendation with checkable evidence; the intended use is
triage, with a qualified reviewer adjudicating flagged tasks. Nothing is written to the repositories (tools are
read-only, workspaces are throwaway shallow clones) and no external action is taken.

---

## 2a. Use it from a shell

fairtask screens one task at a time; the evaluation harness in §3–§5 is built on top of the same command. If you work inside an agent rather than a terminal, start with [§2b](#2b-use-it-from-inside-your-agent) instead.

```bash
git clone https://github.com/mnkprs/fairtask && cd fairtask && npm ci
claude login            # or: export ANTHROPIC_API_KEY=...

# any instance of a SWE-bench-style dataset on Hugging Face (SWE-bench, SWE-bench_Verified, Multimodal, …)
npm run screen -- --swebench django__django-11099
npm run screen -- --swebench astropy__astropy-12544 --dataset princeton-nlp/SWE-bench_Verified

# a task of your own
npm run screen -- --task my-task.json
```

`my-task.json` is what a task-construction pipeline already has for every candidate:

```json
{
  "instance_id": "myorg__myrepo-1234",
  "repo": "myorg/myrepo",
  "base_commit": "0123abcd…",
  "problem_statement": "<the issue text exactly as the solver will see it>",
  "patch": "<unified diff of the fix — the gold patch>",
  "test_patch": "<unified diff of the tests added by the PR>",
  "FAIL_TO_PASS": ["tests/test_x.py::test_y"]
}
```

`repo` may be `owner/name` or a full URL; the repository is shallow-cloned at `base_commit` into `workspaces/`
(read-only for the agent). `FAIL_TO_PASS` is optional but matters: only graded tests should count against a task.
Options: `--variant` (`v3-verify` default; `v5-cheap-probes` for the −40% cost configuration, `v6-target-aware`
for the high-recall one), `--model`, `--out`.

The command prints the decision, both scores with their rationales, and every evidence item with its location, and
writes `screenings/<instance_id>/verdict.json` plus the full trajectory. Two complete examples are committed under
`examples/` (`django__django-11099`, `psf__requests-2317`), verdict and trajectory. `npm run show -- <instance_id>`
writes an evaluation instance's pieces as separate readable files (issue, test patch, gold patch, human labels) —
`examples/astropy__astropy-12544/` is the challenging case laid out that way. A verdict looks like this (abridged, from the
challenging case):

```
FLAG   underspecified=1  false_negative=3  confidence=5/5  (evidence verified)

Test scope (3): The hidden tests require the keyword `mask_invalid`, which the issue never mentions — the issue
proposes `mask`. Any solver implementing the issue as written fails all FAIL_TO_PASS tests. …

Evidence (4):
  [false_negative] test_patch astropy/io/fits/tests/test_connect.py
     The graded tests call the new keyword by a name the issue does not state.
     › tab = Table.read(filename, mask_invalid=False)
  [false_negative] issue
     The issue proposes a different name for the same behaviour.
     › Ideally, a keyword like `Table.read(filename, ..., mask=False)` would disable this behaviour
```

Cost is about $1 and three minutes per task with the default configuration (Opus 5 judge and probes), about $0.55
with `--variant v5-cheap-probes`. Verdicts are recommendations for a human reviewer, who should open the cited lines
of any flagged task before dropping it — see §6 for why the labels the pipeline was tuned against are themselves
imperfect.

---

## 2b. Use it from inside your agent

This is the interface the project is built for. The people who screen tasks in 2026 do it inside agents — a
Claude Code or Codex session that already has the repository open, the PR in front of it, and the rest of the
task-authoring workflow around it. fairtask ships as **two agent skills** on top of the same engine, so the screening
and the evaluation happen in the conversation, and the numbers a session reports come from the scripts, not from
the model's memory.

### Install once

| Where you work | Install | What you get |
|---|---|---|
| Any harness that reads the open skills registry (Claude Code, Codex, Cursor, OpenCode, …) | `npx skills add mnkprs/fairtask` | both skills, installed into that harness's skills directory |
| Claude Code, as a plugin | `/plugin marketplace add mnkprs/fairtask` then `/plugin install fairtask@fairtask` | both skills (plugin manifest in `.claude-plugin/`) |
| Codex, as a plugin | the repository carries `.codex-plugin/plugin.json` | both skills |

One install brings the whole command set:

| Command | What it does | Model calls |
|---|---|---|
| `/fairtask <id \| task.json \| owner/repo PR#>` | Screen a task with the full pipeline; verdict with verified evidence. | yes (~one dollar) |
| `/fairtask-baseline <id \| task.json>` | The same task through the one-prompt baseline, for comparison; its evidence is *not* machine-verified. | yes (~fifteen cents) |
| `/fairtask-report` | The headline and all-systems tables from the committed results. | no |
| `/fairtask-score [run ids…]` | Metrics of runs against the human labels. | no |
| `/fairtask-cases [id]` | The 30-case evaluation set, or one instance laid out with its decisive lines quoted. | no |
| `/fairtask-trajectory <id> [run]` | What the agent did on an instance, tool call by tool call. | no |
| `/fairtask-eval …` | The supporting checks: evidence audit, zero-LLM code check, data provenance. | no |

All need Node ≥ 22.18 and git. `/fairtask` also needs a Claude login or `ANTHROPIC_API_KEY`, because it runs
the model; `/fairtask-eval` needs neither.

### `/fairtask` — screen a task

Give it any of three things; it does the rest and reports in the conversation.

| You type | What happens |
|---|---|
| `/fairtask django__django-11099` | Fetches that SWE-bench instance from Hugging Face, shallow-clones Django at the task's base commit, runs the judge and the two probes, verifies every quoted line, and reports the verdict. |
| `/fairtask my-task.json` | Same for your own task file (`repo`, `base_commit`, `problem_statement`, `patch`, `test_patch`, `FAIL_TO_PASS`). |
| `/fairtask astropy/astropy 12544` | A pull request. The skill first runs `scripts/task-from-pr.sh`, which builds the task file from the PR with `gh` (base commit, the linked issue's text, code diff, test diff, added tests). It **fails closed** — exits with reasons — if the PR has no linked issue, no test file, or no graded test it can confirm; the skill reports those reasons and stops unless you explicitly accept a provisional screening. Then it screens the task. |

What comes back — the engine's own output for the committed example `examples/psf__requests-2317/` (the skill
reads it from `verdict.json` and repeats it in the conversation, then says what to do with it):

```
USABLE   underspecified=0  false_negative=1  confidence=4/5  (evidence verified)

Issue specification (0): The issue names the exact file and line (`requests/sessions.py`: `method = builtin_str(method)`), the exact wrong behavior (b'GET' becomes the literal string "b'GET'" under Python 3, yielding 404), and the desired behavior ("if requests handled the method value being a binary string, we wouldn't have any problem"). I confirmed the buggy line exists at requests/sessions.py:428 and that the canonical helper `to_native_string` is already imported in the very same module at line 21 and already used a few lines above at line 136 (`prepared_request.url = to_native_string(url)`), so the conventional fix is directly signposted by existing code. There is essentially no ambiguity about what a successful solution looks like.

Test scope (1): The new test `test_encoded_methods` is implementation-agnostic: it only does `r = requests.request(b'GET', httpbin('get')); assert r.ok`. It never inspects the method's type, never references `to_native_string`, and imposes no naming or message constraints, so a fix via `to_native_string`, `method.decode('ascii')`, or an `isinstance(method, bytes)` branch all pass equally. The only residual risk is that the FAIL_TO_PASS list bundles seven pre-existing, network-dependent tests (test_HTTP_302_ALLOW_REDIRECT_GET, test_POSTBIN_GET_POST_FILES, test_basicauth_with_netrc, test_json_param_post_content_type_works, etc.) that hit `HTTPBIN = os.environ.get('HTTPBIN_URL', 'http://httpbin.org/')`. I spot-checked these (e.g. test_requests.py:140-144 calls `requests.get(httpbin('redirect', '1'))` with a plain string method) and they do not touch the patched code path at all, so they are neutral between competing correct solutions rather than biased toward the gold patch — they add environment flakiness risk equal for gold and for any reasonable fix, which keeps this at 1 rather than 2.

Evidence (3):
  [underspecified] repo requests/sessions.py:L21
     The helper needed for the fix, to_native_string, is already imported in sessions.py at the base commit, making the conventional fix directly discoverable from the issue's pointer to the buggy line.
     › from .utils import to_key_val_list, default_headers, to_native_string
  [false_negative] repo test_requests.py:L140-L142
     The extra FAIL_TO_PASS tests are pre-existing network tests using plain-string methods that cannot depend on the bytes-method fix; they only add environment flakiness, equally for any solution.
     ›  def test_HTTP_302_ALLOW_REDIRECT_GET(self): r = requests.get(httpbin('redirect', '1')) assert r.status_code == 200
  [false_negative] test_patch test_requests.py
     The new test asserts only that the request succeeds, imposing no constraint on how bytes methods are normalized.
     ›  r = requests.request(b'GET', httpbin('get')) assert r.ok

$0.49 · 195s · 8 turns
```

The skill then says what to do with it: for FLAG, open the cited lines and decide; for USABLE, nothing. It presents
every verdict as a recommendation for a human reviewer, never as ground truth — on the evaluation set this pipeline
agrees with expert humans about as often as a one-prompt baseline; what it adds is evidence you can check.

How it finds the engine: `FAIRTASK_HOME` if set, else `~/.fairtask`; if neither exists it clones **the pinned
release tag** (`--branch v0.1.0`), never a moving branch, runs `npm ci`, and says so. If the engine cannot run at all
(no Node, no credentials), the skill switches to **manual mode**: it performs the two probes' procedures itself with
its own read-only tools, following `skills/fairtask/references/method.md`, re-opens every location it cites to
confirm the quote, and states in the report that the quotes were self-checked rather than machine-verified.

### The evaluation commands — reproduce and inspect every number

Everything a judge or reviewer might want to see, run from inside the session with the output printed verbatim.
No model calls; offline except the two pinned data downloads; they refuse to start paid reproduction runs and point
at `REPRODUCE.md` instead.

| You type | What it runs, and shows |
|---|---|
| `/fairtask-cases` | `npm run data:eval-set` — the 30-row table (instance, stratum, human scores, difficulty, sizes) and the per-stratum and per-repository counts. |
| `/fairtask-score baseline v3-verify` | `npm run score -- baseline v3-verify` — decision accuracy, κ, TPR/TNR, missed/false alarms, per-axis agreement, cost and time, side by side. |
| `/fairtask-report` | `node src/report.ts …` — the two tables in §4, as aligned terminal tables. |
| `/fairtask-eval audit evidence for v3-verify` | `npm run audit -- v3-verify` — share of cited quotes that do not exist where cited (needs `npm run data:workspaces`, which it tells you to run). |
| `/fairtask-eval check the annotation provenance` | `npm run data:annotations -- --check` — SHA-256 of the committed file against the pinned source. |
| `/fairtask-cases astropy__astropy-12544` | `npm run show -- astropy__astropy-12544` — writes `examples/<id>/`, then shows the human labels and quotes, with `file:line`, what the issue asks for and what the graded tests require. |
| `/fairtask-trajectory astropy__astropy-12544 v3-verify` | renders and opens that run's trajectory. |

### What the skills may and may not do

- The screening agents get read-only tools (`Read`, `Grep`, `Glob`) and a hook that denies any path outside the task's
  repository — they cannot read the evaluation labels, other tasks, or your files. Only the two declared probes can be
  dispatched. Nothing is written to the repository under review; workspaces are throwaway shallow clones.
- `/fairtask` spends money (about $1 per task at list price; $0.55 with `--variant v5-cheap-probes`) and says so.
  `/fairtask-eval` spends nothing.
- A verdict is triage, not a decision. The human reviewer adjudicates flagged tasks from the cited lines.

## 2c. Command reference

Every command is an npm script. The `--` after `npm run <script>` is npm's separator: what follows it goes to the
script, not to npm. An **instance id** is a SWE-bench task name, `<owner>__<repo>-<pull request number>`. A **run id**
is a directory under `results/`; the committed ones are `baseline`, `baseline-rerun`, `v1-context`, `v2-specialists`,
`v3-verify`, `v4-calibrated`, `v5-cheap-probes`, `v5-rerun`, `v6-target-aware`, `v7-sonnet-nocal`. Each row below is
a complete command; rows with the same script differ by one flag.

### Screen one task

| Command | What it does |
|---|---|
| `npm run screen -- --swebench django__django-11099` | Fetches the task from the `princeton-nlp/SWE-bench` test split on Hugging Face, shallow-clones `django/django` at its base commit into `workspaces/django__django-11099/repo`, runs the default pipeline (`v3-verify`) with `claude-opus-5`, prints the verdict, writes `screenings/django__django-11099/verdict.json` and the trajectory next to it. |
| `npm run screen -- --swebench astropy__astropy-12544 --dataset princeton-nlp/SWE-bench_Verified` | Same, taking the instance from another SWE-bench-style dataset on Hugging Face. |
| `npm run screen -- --task my-task.json` | Screens your own task. Required fields: `repo` (`owner/name` or URL), `base_commit`, `problem_statement`, `patch` (gold), `test_patch`; optional `instance_id`, `FAIL_TO_PASS`. Refuses a file marked `_status: unconfirmed`. |
| `npm run screen -- --task my-task.json --allow-unconfirmed` | Screens it anyway; the test-axis score is provisional. |
| `npm run screen -- --swebench <id> --variant v5-cheap-probes` | Uses Sonnet 5 for the two probes (judge stays on Opus 5): same decisions within noise, about 40% cheaper. `v6-target-aware` is the high-recall configuration; any variant name from `src/variants/` works. |
| `npm run screen -- --swebench <id> --model claude-sonnet-5` | Runs the judge (and probes, unless the variant pins them) on another model. |
| `npm run screen -- --swebench <id> --out /tmp/screenings` | Writes the verdict and trajectory under another directory. |
| `skills/fairtask/scripts/task-from-pr.sh astropy/astropy 12544 > task.json` | Builds a task file from a pull request with `gh`: base commit, the linked issue's text (from whichever repository it lives in), code diff, test diff, added test functions. Exits 3 with reasons if the PR has no linked issue, no test file, or no confirmable graded test. |
| `skills/fairtask/scripts/task-from-pr.sh astropy/astropy 12544 --lenient > task.json` | Emits the task anyway, marked `_status: unconfirmed` with the reasons in `_problems`. |

### Evaluate (no API key needed: reads the committed results)

| Command | What it does |
|---|---|
| `npm run score -- baseline v3-verify` | Prints the metrics of each run against the human labels side by side (decision accuracy, κ, TPR/TNR, missed problems / false alarms, both-axes agreement, per-axis exact and ±1, cost, time) and writes `results/<run>/summary.json`. Any number of run ids. |
| `npm run score -- baseline v3-verify --detail` | Adds one row per instance: human scores, predicted scores, decision, cost. |
| `npm run score -- baseline v3-verify --common` | Restricts every run to the instances all listed runs scored (for comparing partial runs). |
| `npm run score -- baseline --json` | The summary as JSON instead of the table. |
| `node src/report.ts --baseline baseline --final v3-verify` | Prints the headline comparison of those two runs as an aligned terminal table (the same rows as §4). Needs cloned workspaces (`npm run data:workspaces`, ~20 s) — the bad-evidence rows re-verify every quote against the repositories. |
| `node src/report.ts --baseline baseline --final v3-verify --markdown` | The same as a Markdown pipe table — what `scripts/finalize-report.py` pastes into this README. |
| `node src/report.ts --baseline baseline --final v5-cheap-probes --final-repeat v5-rerun` | Shows the final configuration as "first run · repeat run". The repeat must be a run of the same configuration; the script refuses otherwise. |
| `node src/report.ts --baseline baseline --final v3-verify --runs baseline,v1-context,v3-verify` | Adds the all-systems table with those runs as rows. |
| `npm run audit -- baseline v3-verify` | Runs the deterministic verifier over every stored verdict: how many cited quotes do not exist where cited. Needs cloned workspaces at the right commits (refuses otherwise). |
| `npm run code-check` | The zero-LLM pre-check: identifiers used by graded tests, introduced by the gold patch, absent from issue and repository; prints per-instance hits and TPR/TNR against the human label. Needs workspaces. |
| `npm run show -- astropy__astropy-12544` | Writes `examples/astropy__astropy-12544/{issue.md,test.patch,gold.patch,human-labels.md}` with links to the repository, base commit and pull request. |
| `npm run show -- astropy__astropy-12544 --out /tmp/views` | Same, under another directory. |
| `npm run trajectory -- trajectories/v3-verify/astropy__astropy-12544.jsonl` | Renders a trajectory (instructions → tool calls → probe reports → verification → verdict) as Markdown next to the JSONL, with long tool outputs truncated. |
| `npm run trajectory -- trajectories/v3-verify/astropy__astropy-12544.jsonl --full` | Same without truncation. |
| `scripts/finalize-report.py v3-verify baseline baseline-rerun v1-context …` | Re-scores every listed run and regenerates the README and REPRODUCE tables. Needs workspaces. |

### Run the pipeline over the evaluation set (needs `claude login` or `ANTHROPIC_API_KEY`)

| Command | What it does |
|---|---|
| `npm run run -- --variant v3-verify --run-id v3-verify-repro` | Runs one system over all 30 instances at concurrency 3, writing `results/v3-verify-repro/predictions.jsonl` and one trajectory per instance. Resumable: instances already in the file are skipped. Variants: `baseline`, `v1-context`, `v2-specialists`, `v3-verify`, `v4-calibrated`, `v5-cheap-probes`, `v6-target-aware`, `v7-sonnet-nocal`. |
| `npm run run -- --variant baseline --run-id baseline-repro --model claude-sonnet-5` | Same with another model. |
| `npm run run -- --variant v3-verify --run-id smoke --only sympy__sympy-14711,psf__requests-1888` | Only those instances. |
| `npm run run -- --variant v3-verify --run-id v3-verify-repro --concurrency 2` | Fewer parallel sessions (use 4–5 total on a Claude subscription). |
| `npm run run -- --variant v3-verify --run-id v3-verify-repro --retry-errors` | Re-runs the instances that errored last time (their rows move to an attempts ledger; their cost stays in the totals). |
| `npm run run -- --variant v3-verify --run-id v3-verify-repro --force` | Discards the run directory and starts over. Without it, a run id refuses to resume under a different configuration. |

### Data (public inputs; the committed outputs are byte-exact reproductions)

| Command | What it does |
|---|---|
| `npm run data:annotations` | Downloads OpenAI's annotation CSV from its pinned mirror commit and refuses to write it unless the SHA-256 matches the value recorded in `data/raw/SOURCES.md`. |
| `npm run data:annotations -- --check` | Verifies the committed CSV against that SHA-256, offline. |
| `npm run data:eval-set` | Rebuilds `data/eval/instances.json` — the 30 cases — from the SWE-bench parquet and the annotations with the fixed seed, and prints the table. |
| `npm run data:eval-set -- --seed 7 --n 50` | Builds a different sample (for a held-out set); do not commit it over the original. |
| `npm run data:calibration` | Rebuilds `data/eval/calibration.json` (annotator notes for non-evaluation instances, per repository) and asserts no evaluation instance leaks in. |
| `npm run data:workspaces` | Shallow-clones the 30 repositories at their base commits into `workspaces/` (about 20 s). |
| `npm run data:workspaces -- --only sympy__sympy-14711 --jobs 2` | Only those instances, with that many parallel clones. |

### Checks

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript, no emit. |
| `npm test` | 23 adversarial tests: verifier (fabricated, elided, cross-hunk, removed-line and symlinked quotes), workspace trust (symlinked path, dirty tree, wrong remote, bad commit), run lock and screening ids. |
| `npm run validate:manifests` | Semantic check of the plugin manifests and both skills' frontmatter. |

## 2d. Agent trajectories

Every run of every agent is recorded as JSONL and rendered to Markdown next to it (`npm run trajectory -- <file>`).
A rendered trajectory reads top to bottom as: **Agent instructions** (the judge's system prompt with the rubric, the
task prompt, and the full instructions of each subagent it may dispatch) → **Execution** (every tool call with its
input, every tool result or error, each probe's report, the judge's own spot-checks) → **Result** (the JSON verdict,
cost and turns) → **Verification** (what the deterministic verifier found; if it failed, the feedback sent back and
the corrective turn). The representative ones, one per agent and one per kind of feedback:

| Agent / situation | Trajectory | What to look at |
|---|---|---|
| **Baseline** — one prompt, no tools | [`trajectories/baseline/astropy__astropy-12544.md`](trajectories/baseline/astropy__astropy-12544.md) | Instructions and task prompt, then the verdict straight away. It flags the task (humans: flag, `false_negative` 3) but also scores the issue 2 where humans gave 0 — the right decision for half the right reasons; every configuration keeps the flag, while the issue-axis score wobbles between 1 and 2 across runs (§6). |
| **Single agent with repository tools** (v1) | [`trajectories/v1-context/astropy__astropy-12544.md`](trajectories/v1-context/astropy__astropy-12544.md) | The same prompt plus `Read`/`Grep`/`Glob`: what it reads, and how reading the code made it *more* lenient (§5, Iteration 1). |
| **Judge + `spec-probe` + `test-probe`** (v3, the final default) | [`trajectories/v3-verify/astropy__astropy-12544.md`](trajectories/v3-verify/astropy__astropy-12544.md) | Instructions for all three agents (`### Subagent spec-probe`, `### Subagent test-probe`); the judge dispatching both in parallel; each probe's `Read`/`Grep` calls and the file contents that came back; the two probe reports with evidence; the judge re-opening the cited lines itself ("Now spot-checking the strongest claims myself"); the final verdict; `✅ Verification passed`. |
| **Verifier feedback and a corrective turn** | [`trajectories/v4-calibrated/scikit-learn__scikit-learn-11574.md`](trajectories/v4-calibrated/scikit-learn__scikit-learn-11574.md) · [`trajectories/v5-cheap-probes/sphinx-doc__sphinx-8284.md`](trajectories/v5-cheap-probes/sphinx-doc__sphinx-8284.md) | `⛔ Verification failed (attempt 1)`: the verifier names the evidence item whose quote is not in the test patch, the exact feedback text sent to the judge, the judge's re-check with `Grep`, and the corrected verdict that passes. These are the only two corrective turns in 300 evaluation runs — the announcement that quotes will be checked did the work (§5, Iteration 3). |
| **A tool refusing the agent** | same `sphinx-doc__sphinx-8284.md` | `❌ error` entries: both probes, then the judge, asked to `Read` paths that do not exist (a mistyped directory, then an absolute `/repo/…` path); the tool answered `File does not exist` with the correct working directory, and each agent corrected its path on the next call. |
| **The strict-reviewer framing** (v6) | [`trajectories/v6-target-aware/astropy__astropy-12544.md`](trajectories/v6-target-aware/astropy__astropy-12544.md) | The same case under the instructions that name the reference label as a maximum over three annotators. |
| **A real screening from the skill** | [`examples/psf__requests-2317/trajectory.md`](examples/psf__requests-2317/trajectory.md) · [`examples/django__django-11099/trajectory.md`](examples/django__django-11099/trajectory.md) | Produced by `/fairtask` on a task outside the evaluation set: no human label in the header, the calibration block the v5 configuration adds, the verdict the skill reported in §2b. |

**Human checkpoints.** The pipeline has three, all deliberate: (1) `task-from-pr.sh` fails closed when it cannot
confirm the issue or the graded tests, and the skill reads the task back for a one-line confirmation before spending
money; (2) a verdict marked `verified: false` after the corrective turns is refused — `screen` exits non-zero and the
skill says so, rather than reporting unverified evidence; (3) every FLAG is a recommendation with cited lines, and a
human adjudicates it. Nothing is dropped from a task set on the agent's word.

All 300 evaluation trajectories (10 runs × 30 cases) are under `trajectories/<run>/`, and every one of them embeds
the exact instructions its agents ran with, so a prompt change in `src/variants/` or `src/lib/rubric.ts` can be
matched to the runs that used it.

---

## 3. Evaluation design

- **Cases:** 30 SWE-bench test instances, sampled with a fixed seed from the 1,699 human-annotated ones, stratified so
  the set is not dominated by any defect type: 10 *clean* (both scores ≤ 1), 8 *underspecified* only, 8 *unfair
  tests* only, 4 *both*; at most 5 per repository, 10 repositories. Instances with "other major issues" were
  excluded so the labels are about the two axes. Full list: `data/eval/instances.json`.
- **Ground truth:** OpenAI's ensembled annotation (max severity over three annotators) on the same 0-3 scales, and
  the derived decision *usable* ⇔ both ≤ 1 — the rule SWE-bench Verified itself used.
- **Primary metric:** decision accuracy against the human decision. Secondary: Cohen's κ (chance-corrected),
  missed problems / false alarms, whether *both axes* were flagged correctly (a stricter check that the system is
  right for the right reason), per-axis exact and ±1 agreement, cost and wall-clock per task.
- **Fairness:** the baseline and every iteration see the identical material (issue, gold patch, test patch,
  FAIL_TO_PASS list, the same rubric text), and the deciding model is `claude-opus-5` in every system (the
  baseline's single call and every judge). The only model change anywhere is the cost experiment, which moves the
  two *probes* to `claude-sonnet-5` while the judge stays on Opus 5. Otherwise only the capabilities differ.
- **The challenging case** is `astropy__astropy-12544` (chosen before any run): the issue explicitly asks for a
  `mask` argument, the gold patch implemented `mask_invalid`, and the tests require the latter — humans scored it
  underspecified = 0, false_negative = 3. It tests whether a system can tell "the issue is clear" and "the tests are
  unfair" apart instead of collapsing them into one bad feeling about the task.

---

## 4. Results

### Headline comparison (30 cases, development set — same cases and same deciding model for both)

| Metric | Simple baseline (`baseline`) | Agent solution (`v3-verify`) | Change |
|---|---|---|---|
| **Primary: decision accuracy vs. human annotators** | 67% | 67% | 0 pts |
| Flag recall (human-flagged tasks caught) | 70% | 75% | +5 pts ▲ |
| TPR / TNR (flagged caught / clean left alone; scored cases only) | 70% (14/20) / 60% (6/10) | 75% (15/20) / 50% (5/10) | — |
| Missed problems / false alarms | 6 / 4 | 5 / 5 | — |
| Cohen's κ vs. humans | 0.29 | 0.25 | -0.04 ▼ |
| Both axes flagged correctly | 37% | 37% | 0 pts |
| Cited evidence that fails verification (item rate) | 8% (7/91) | 0% (0/141) | — |
| Human time per task (assumption: 90 min of expert review today) | 90 min | reviewer checks cited evidence only | — |
| Machine wall-clock per task | 41 s | 186 s | +145 s ▼ |
| Cost per task (USD, list price) | $0.14 | $0.95 | +$0.81 ▼ |
| Challenging case (`astropy__astropy-12544`) | correct (us=2 fn=3 flag) | correct (us=2 fn=3 flag) | human: us=0 fn=3 flag |

### All systems on the same 30 cases (development set)

| Run | Decision acc. | κ | TPR / TNR | Missed / false alarms | Both axes | Bad evidence | Cost/task | Time/task |
|---|---|---|---|---|---|---|---|---|
| `baseline` | 67% | 0.29 | 70% / 60% | 6 / 4 | 37% | 8% (7/91) | $0.14 | 41 s |
| `baseline-rerun` | 67% | 0.29 | 70% / 60% | 6 / 4 | 40% | 11% (10/88) | $0.13 | 42 s |
| `v1-context` | 60% | 0.18 | 60% / 60% | 8 / 4 | 40% | 2% (2/83) | $0.25 | 62 s |
| `v2-specialists` | 67% | 0.29 | 70% / 60% | 6 / 4 | 43% | 6% (8/142) | $0.92 | 176 s |
| `v3-verify` | 67% | 0.25 | 75% / 50% | 5 / 5 | 37% | 0% (0/141) | $0.95 | 186 s |
| `v4-calibrated` | 60% | 0.14 | 65% / 50% | 7 / 5 | 37% | 1% (1/151) | $0.93 | 181 s |
| `v5-cheap-probes` | 70% | 0.34 | 75% / 60% | 5 / 4 | 43% | 0% (0/126) | $0.55 | 184 s |
| `v5-rerun` | 63% | 0.23 | 65% / 60% | 7 / 4 | 40% | 0% (0/120) | $0.57 | 171 s |
| `v6-target-aware` | 70% | 0.27 | 85% / 40% | 3 / 6 | 37% | 1% (2/149) | $0.88 | 170 s |
| `v7-sonnet-nocal` | 63% | 0.20 | 70% / 50% | 6 / 5 | 33% | 0% (0/127) | $0.60 | 200 s |

*How to read this.* "Decision accuracy" is agreement with the human usable/flag decision. "Bad evidence" is the
share of cited evidence items whose quote is not found where the verdict says (file at base commit / patch / issue),
checked by the same deterministic verifier for every run, including the ones that never used it. The baseline was
run twice (`baseline`, `baseline-rerun`): identical accuracy and κ, the same decision on 28/30 cases (two flips that
cancelled out), so run-to-run noise on this set is about ±1–2 cases (±3–7 points).
Cost is the list-price USD the SDK reports (`total_cost_usd`); on a subscription it consumes usage allowance instead.

**Human time per task** is an assumption, not a measurement: OpenAI did not publish per-task annotation time.
Each annotation required reading the issue, the PR diff and tests, and browsing the codebase (the instructions ask
for ≥100-character justifications per axis) and each task got three annotations; 90 minutes of expert time per task
is a conservative round number for that. With the agent in front, the reviewer's job shrinks to opening the cited
lines of a flagged task.

**The challenging case** (`astropy__astropy-12544`) was decided correctly by every system; the interesting part is
the axis. Humans: issue clear (0), tests unfair (3). Every configuration found the test-axis problem with the right
evidence — the `mask_invalid` assertions quoted from the test patch against the issue's own `mask` wording — but the
baseline and the default pipeline (`v3-verify`) also scored `underspecified = 2`, arguing that the issue leaves the
single-table and memmap behaviour open. Four runs put it at 1, on the human side of the threshold (`v1`, `v2`, `v4`
and the first `v5` run); the baseline repeat, `v5-rerun`, `v6` and `v7` stayed at 2. Right decision, one axis
debatable — and unstable from run to run — which is why the "both axes correct" metric exists.


---

## 5. Improvement changelog

Every row was run on the same 30 cases with the same model; the evidence column is what `npm run score` and
`node src/evidence-audit.ts` print from the files under `results/`. "Bad evidence" = share of cited evidence items
whose quote does not exist where the verdict says it does (checked by the same deterministic verifier for every run).

| Stage | What was tried and why | Evidence (30 cases) | Decision / learning |
|---|---|---|---|
| **Baseline** `baseline` | One prompt: the rubric + issue + gold patch + test patch + FAIL_TO_PASS list. No tools. What a team would try first. | **67%** decision accuracy, κ 0.29, recall 70%, 6 missed / 4 false alarms, **8% bad evidence** (23% of verdicts cite something that is not there; 11% / 23% on the repeat), $0.14, 41 s. Repeat run: 67% / κ 0.29, same decision on 28/30 cases. | Starting point. Strong on the easy strata (4/4 *both*), weak on *clean* (6/10) and *underspecified* (4/8). Fabricated or paraphrased "quotes" are the visible quality problem. |
| **Iteration 1** `v1-context` — better context | Same single agent, now with read-only `Read`/`Grep`/`Glob` on the repository at the base commit plus an investigation procedure. Hypothesis: the human annotators had the codebase open; the model should too. | **60%** (−7), κ 0.18, recall 60%, **8 missed**. Per-axis MAE on *underspecified* improved (0.73→0.63) but the decision got worse. Bad evidence 2%. | **Kept the tools, dropped the design.** Reading the code made the agent *more lenient*: with a clear symptom and an obvious code path in view it scored issues 0–1 that humans scored 2 because the *solution* was open ("many ways to achieve this" — `sympy-18650`, `pytest-10552`). More context raised confidence, not calibration. |
| **Iteration 2** `v2-specialists` — orchestration | Split the two questions: a `spec-probe` and a `test-probe` subagent, each with its own method and read-only tools, dispatched in parallel by a judge that spot-checks their strongest claim before deciding. Only the two declared probes can be dispatched (PreToolUse hook). | **67%**, κ 0.29 — back to baseline level; **both axes right 43%** (baseline 37%), recall 70%. Bad evidence 6% (23% of verdicts). $0.92, 176 s. | **Kept.** Specialisation fixed v1's leniency and made the system right for the right axis more often, but it did not beat the baseline on the headline decision, and the evidence still contained non-verbatim quotes. |
| **Iteration 3** `v3-verify` — verification outside the model | A deterministic verifier (no LLM) checks every cited quote against the file at the base commit / the patches / the issue, requires verified evidence for any score ≥ 2, and feeds failures back for up to two corrective turns. | **67%**, κ 0.25, **recall 75%** (best so far), 5 missed / 5 false alarms, **0% bad evidence**. Verification retries: **0** — the judge, told its quotes would be checked, cited accurately on the first attempt in all 30 cases. $0.95, 186 s. | **Kept.** The verifier's measurable effect is on evidence quality (8% → 0% bad items) and recall; the headline decision did not move. The announcement of verification did the work — the retry loop never fired. |
| **Iteration 4** `v4-calibrated` — memory / calibration | v3 + each probe shown how human annotators scored its axis on *other* issues of the same repository (from the 1,600+ non-evaluation annotations; leakage-checked by instance id). Hypothesis: the scales are judgement calls and examples would anchor them. | **60%** (−7 vs v3), κ 0.14, 7 missed. Mean predicted `false_negative` fell 1.83 → 1.63; the two flipped cases (`django-14495`, `sympy-13146`) both went from a correct *flag* to *usable*. 0% bad evidence. | **Removed.** The examples pushed the probes toward leniency on the test axis — human notes on other issues are mostly "the tests cover all reasonable solutions", and the probes copied that stance. Calibration by example needs examples of the *failure*, not a random sample. |
| **Experiment** `v5-cheap-probes` — cost | v4's pipeline with both probes on Claude Sonnet 5 and the judge kept on Opus 5. Meant as a cost experiment. | First run **70%**, κ 0.34, recall 75%, 5 missed / 4 false alarms; **repeat run 63%**, κ 0.23, recall 65%, 7 missed / 4 false alarms; the two runs agree on 28/30 decisions. 0% bad evidence in both. **$0.55** per task (−42% vs v3), ~180 s. | **Kept as the cost-efficient configuration.** Averaged over two runs it matches the baseline on the headline decision (67%) at 0% bad evidence and 60% of the v3 cost. The 70% first run was partly luck — the repeat is why every headline number in this report carries a ±2-case caveat. Because v5 inherits v4's calibration examples, the ablation below isolates the probe-model change. |
| **Iteration 6** `v6-target-aware` — target definition | v4 + every agent told what the reference label *is*: the maximum severity over three independent annotators, so a 2 is warranted whenever a careful, strict reviewer could argue for it. A property of the dataset documented before any run, not a tuned threshold. | **70%**, κ 0.27, **recall 85%** (best; 3 missed), but **6 false alarms** (precision 74%), both axes 37%, 1% bad evidence (2 items: one quotes only removed lines), $0.88, 170 s. | **Kept as an option, not the default.** It does what it says — the system flags more of what humans flagged — and pays in false alarms on *clean* tasks. For a triage tool where humans adjudicate flags, the higher recall may be the better trade; the default stays with the configuration that balances both. |
| **Ablation** `v7-sonnet-nocal` | v3's pipeline (no calibration examples) with the probes on Sonnet 5 — isolates the probe-model change from the calibration memory that v5 had inherited. | **63%**, κ 0.20, recall 70%, 6 missed / 5 false alarms, 0% bad evidence, $0.60, 200 s. Agrees with both v5 runs on 28/30 decisions. | **Settles the attribution.** Sonnet probes with or without calibration land in the same place as the v5 repeat; the calibration memory has no reliable effect in either direction (v3 67% → v4 60% with Opus probes; v7 63% → v5 63–70% with Sonnet probes). It is not part of the final default. |
| **Final** `v3-verify` (default) | The design every later variant shares: two specialist probes with read-only repository tools, a judge that spot-checks them, JSON-schema output, a deterministic evidence verifier with feedback retries, and no component whose effect could not be shown. Two documented options: probes on Sonnet 5 (`v5`/`v7`: same decisions within noise, −40% cost) and the strict-reviewer framing (`v6`: recall 85%, more false alarms). | **67%** decision accuracy — level with the baseline's 67% (both stable claims: baseline 67%/67% on repeat; agent variants 60–70% across eight runs), recall 75% (baseline 70%), **0% bad evidence** (baseline 8–11%), $0.95 and ~3 min per task. | **Main contribution: verifiable evidence and higher recall, not a higher headline score.** The deterministic verifier is the change that mattered most (8–11% → 0% unverifiable evidence, with the retry loop almost never firing); orchestration into specialists repaired the leniency that repository access alone introduced. The headline metric is capped by the labels (§6). |


---

## 6. Main failure mode, and the hot take

**The failure mode that survived every iteration is not in the agent — it is in the reference labels.** Five of the
30 cases are decided wrongly in *all 10 runs* of every system, from the no-tools baseline to the final pipeline
(`astropy-14182`, `pytest-5840`, `pytest-7939`, `sympy-12977`, `sympy-18650`); a sixth, `pytest-11041`, is caught only
by the strict-reviewer configuration. Reading them
against the annotators' own notes:

- **The label is the maximum over three annotators.** `sympy-18650` has a one-line reproducer and the expected
  output ("The results should just be `2`"); one annotator scored it *underspecified = 2* because "there are many
  ways to achieve this requirement", and the max-ensemble made that the label. Every system, given the rubric
  ("is it clear what is required for a successful solution?"), answered 0. The rubric and the ensembling rule pull
  in different directions, and the human-human agreement that would tell us how much is not recoverable: the
  per-annotator file is not mirrored anywhere reachable, only the ensembled one.
- **Annotators graded the whole test patch; SWE-bench grades FAIL_TO_PASS.** For `pytest-7939` the annotator's
  *false_negative = 2* rests on `test_stepwise_output_summary` asserting exact output strings the issue never
  mentions. That test is not in FAIL_TO_PASS; it is PASS_TO_PASS — it passes before the fix and constrains no
  solver (checked in `data/eval/instances.json`). The only graded test is a parametrisation of an existing
  behavioural test. Every system, given the F2P list, said *usable* — and by the grading contract, that is right.
- **Ambiguous by rubric, solvable by code.** `sympy-12977` — and, just outside the five, `astropy-13469` and
  `django-14495` — are issues whose *symptom* is precise (traceback, failing line) but whose *fix* has several defensible shapes. Reading the code
  turns "what should happen" into "here is where I would change it" — v1 showed this most starkly (60%), and it is
  the residual error in every later version. The fix is not more context; it is a rubric line that separates
  "I know where to fix it" from "I know what the fix must do", which is what the strict-reviewer framing of v6 tries.

Because these five are unattainable under the current labels, the reachable ceiling on this set is 83%; the default
pipeline's 67% is five cases below it. Three of its remaining errors (`django-14792`, `scikit-learn-25102`,
`sphinx-7985`) are *clean* tasks it flags on the test axis: in each, the probe found a real name, type or format the
tests pin that the issue does not state, and a strict reader can defend the flag. The other two are misses:
`astropy-13469`, where the annotators held the issue's reliance on an external StackOverflow link against it while
the agent found the code path and judged the intent recoverable, and `pytest-11041`, where the annotators flagged
tests that reach beyond the reported walrus-operator case and the default pipeline judged them behavioural. All five
are exactly the cases a human reviewer should adjudicate, and the verdict hands them the line to look at.

**Hot take.** *When you build an agent against human labels, spend the first day auditing the labels with the
agent's evidence, not tuning the agent.* Four practical lessons from the failures:

1. **Announce verification; you may not need to run it.** The deterministic verifier removed 8–11% → 0% unverifiable
   evidence, and the retry loop fired 2 times in 180 verified runs. Telling the model that quotes will be checked
   against the file changed how it cited. Cheap, and it generalises: any agent output that can be checked
   mechanically should be told so in its instructions.
2. **More context makes an agent confident, not calibrated.** Repository access alone made the screener *more*
   lenient (67% → 60%). Context has to be paired with a role that is asked a narrower question — the specialist
   probes recovered the loss, at the same model.
3. **Run it twice before you believe it.** The cost experiment scored 70% on its first run and 63% on its
   repeat, agreeing with itself on 28/30 decisions; the baseline, run twice, gave 67% both times. On a 30-case set
   one flipped case is 3 points — a changelog that reports single runs will "find" improvements that are noise.
4. **Calibration examples calibrate toward the majority stance of the examples.** Random human examples from the
   same repository were mostly "the tests are fine", and the probes learned to say so. If you show examples, show
   examples of the failure you want caught.


---

## 6b. Adversarial review, and what changed because of it

After the runs, an independent adversarial code review (OpenAI Codex via the `codex` plugin, read-only, focused on
evaluation fairness, the verifier, and the runner/scorer) returned eight findings. What was done with each:

| Finding | Verdict | Action |
|---|---|---|
| Tool-enabled agents could read outside the workspace — including the evaluation labels — because `cwd` is not a sandbox, and the trajectory header contained the human labels before the run. | **Valid.** An audit of all 4,059 Read/Grep/Glob calls across the ten runs found 303 outside-workspace attempts (almost all hallucinated paths), 9 of which succeeded: three `files_with_matches` Greps that listed *file names* under `results/`, `trajectories/` and the session transcripts, and six reads of a library in a package cache. No label content reached any agent (no Read/Grep of a label-bearing file; `files_with_matches` returns names only). | A `PreToolUse` hook now denies any path outside the instance workspace (`src/lib/run.ts` → `workspaceGuard`); labels are written to the trajectory only after the model finishes. The three affected instance-runs (`v5` sphinx-11445, `v7` xarray-4759, `v7` sympy-18650) are disclosed here and were not re-run. |
| The data builders were missing. | **Artifact of the review copy** — the review ran on a code-only copy whose `--exclude data` also dropped `src/data/`. All three builders are in this repository. | None. |
| The verifier could be fooled: deleted diff lines counted as evidence, elided fragments could be arbitrarily far apart, the patch `ref` was ignored, a literal `...` in code was mis-read as an elision. | **Valid.** | Rewritten (`src/lib/verify.ts`): patch quotes are checked per file against the *new side*; quotes that exist only among removed lines are rejected; before/after quotes are routed line by line; elision gaps are bounded; literal matching is tried first. Adversarial tests: `npm test`. |
| A verdict that still failed verification after the retries was stored and scored. | **Valid** (it never happened in the reported runs: 0 of 180 verified verdicts). | Such a verdict is now stored as an error (`verified: false`), counted as missing, and re-run by `--retry-errors`. |
| Resuming a run id with a different variant/model silently mixed systems. | **Valid** (did not occur: every run id maps to one configuration). | `run.json` records a fingerprint of variant, model and instructions; a mismatched resume is refused without `--force`; duplicate rows collapse to one per instance. |
| The scorer's universe was the prediction file: missing instances disappeared, errors were turned into gold-dependent pseudo-labels for κ, cost ignored failed attempts, and the model's own `decision` field was trusted. | **Valid** (no effect on the reported numbers: all runs have 30/30 verdicts and 0 inconsistent decisions — checked). | The universe is now the evaluation set; errors count as wrong for accuracy and as *coverage* for the agreement statistics; the decision is derived from the two scores; errored attempts keep their cost in an append-only ledger. |
| The calibration loader excluded only the current instance, not the whole evaluation set. | **Valid** as defence in depth (the builder already excludes and asserts; verified: 0 overlap). | Runtime guard: loading `calibration.json` fails if it contains any evaluation instance. |
| `--retry-errors` deleted the cost and trace of failed attempts. | **Valid** (the failed attempts were session-limit errors with $0.00 cost). | Errored rows move to `results/<run>/attempts-errored.jsonl` and their cost is included in totals. |

**Second adversarial review (after the fixes above and the `screen` command).** Ten findings; nine valid, one a
disclosure issue. What changed: (1) `instance_id` and `run_id` are validated as slugs and every output path is
checked against its root before any write or delete — a task file could previously name `../workspaces/<other>`
and redirect a re-clone's `rm -rf`; (2) the workspace guard now canonicalises paths with `realpath` (a symlink inside
a repository can no longer point at the labels) and rejects absolute or upward-traversing `Glob` patterns; (3) the
verifier matches patch quotes within a *single hunk* (a quote stitched from two distant hunks no longer passes) and
refuses elided quotes with only one fragment (`long_name = ...` could previously "verify" against any value);
(4) the run fingerprint now covers the task prompt, output schema, tools, hooks, limits, and pipeline/verifier
versions, and a lock file prevents two runners on one run id; superseded and retried attempts keep their rows and
trajectories; (5) the audit and the code-check verify that every workspace is at exactly the base commit with a
clean tree; (6) the code-check only looks at added lines inside FAIL_TO_PASS test functions (TNR 89% → 94%, TPR unchanged at 17%);
(7) TPR/TNR are labelled "scored cases only" with their denominators; (8) the trajectory renderer handles
label-free (screening) trajectories. Re-auditing every run under the stricter verifier moved no number by more than
one evidence item (baseline 8% / 11%, default pipeline 0%).

**Third adversarial review (skill, packaging, CI, examples, and the fixes above).** Eight findings, all valid, all
addressed: (1) a workspace is now trusted only if no path component is a symlink, `HEAD` is the base commit, the tree
is clean and the remote matches; clones land in a temporary directory and are swapped in atomically; repository URLs
carrying credentials are refused; (2) repository evidence is resolved with `realpath` so a tracked symlink cannot
"verify" a quote from outside the repository, patch refs must be an exact touched path (or a unique file name), and
every removed line of a before/after quote is checked, however short (`VERIFIER_VERSION` 4); (3) the run lock is
acquired atomically (`O_EXCL`) before any file is truncated and released only by its owner; predictions are rewritten
through a temporary file; (4) the run fingerprint now digests the full ordered input set and the calibration file;
(5) single-task screenings get a per-attempt id and publish verdict and trajectory atomically; (6) the PR-to-task
script passes bulk data through files rather than argv, takes the file list from GitHub's metadata, resolves a linked
issue in whichever repository it lives, and labels its FAIL_TO_PASS as best effort (it cannot see modified existing
tests); (7) the skill clones the pinned release tag rather than the default branch, checks an existing install is at
that tag, and the Codex manifest discloses write/network/execute; (8) CI runs with `contents: read`, pins both actions
to commit SHAs and the dataset to a revision, fetches with `--fail`, requires the rebuilt `instances.json` and
`calibration.json` to be byte-identical to the committed files, and validates the plugin with Claude Code's own
inventory command. Re-auditing every run under verifier v4 changed no number.

The review's four "next steps" were then executed as well: adversarial tests now cover symlinked and dirty
workspaces, wrong remotes, bad commits, a live and a stale run lock, and concurrent screening ids (23 tests across
three suites, `npm test`); PR ingestion fails closed — `task-from-pr.sh` exits 3 when there is no linked issue, no
test file, or no FAIL_TO_PASS selector confirmable against the tests the PR adds, and `npm run screen` refuses a
task marked unconfirmed unless `--allow-unconfirmed` is passed; and CI validates the manifests semantically
(`npm run validate:manifests`: semver, array shapes, version agreement across manifests and `package.json`, disclosed
Codex capabilities, skill frontmatter, pinned engine tag) and checks the skill is discoverable from the registry.

**Effect on the reported numbers.** The reported runs used the original verifier in the loop. The stricter
post-review verifier was then applied *post hoc* to every verdict of every run; all "bad evidence" figures in this
README are from that stricter audit (it also fixed two false rejections of its own first draft — verbatim patch
quotes carrying `+` markers, and before/after quotes). The picture did not change: 8–11% of the baseline's cited
evidence does not check out, 0% of the default pipeline's, and every decision metric is unaffected.

## 6c. Evaluation-methodology audit (evals-skills `eval-audit`)

A second outside pass, this time over the *evaluation* rather than the code, using Hamel Husain's `eval-audit`
skill on the local artifacts (labels, prompts, predictions, traces, scorer). Findings, and what was done:

| Finding | Status | Action / consequence |
|---|---|---|
| **Alignment is reported as accuracy and κ; with 20 flagged vs 10 usable cases those hide the direction of errors.** In TPR/TNR terms the baseline is 70% / 60%, the default pipeline 75% / 50%, the strict configuration 85% / 40%: each step that raised recall lowered specificity. Part of the "recall gain" is a threshold shift, not better discrimination. | Problem existed | TPR/TNR added to every table (`npm run score`, `src/report.ts`). The claim in this report is now stated as a trade: the pipeline catches more flagged tasks at the cost of more false alarms on clean ones; κ, which already reflected this, stays as the summary number. |
| **No held-out test set.** The same 30 cases were used to diagnose errors *and* to measure every iteration; the v6 framing in particular was designed after reading errors on these cases. Reported numbers are dev-set numbers. | Problem exists | Not fixable before the deadline without another ~$30 and an hour per configuration. Documented here as the first thing to do next: sample a second, disjoint 30–50 cases from the remaining 1,669 annotated tasks with the same builder (`--seed`), run only `baseline` and `v3-verify` on it, and report those as the test numbers. |
| **Judges use 0–3 scales rather than binary single-failure-mode checks.** The decision is binary (≤ 1 vs ≥ 2), but the probes reason on Likert scales inherited from the human rubric, and "underspecified" is a holistic judgement. The audit's recommendation is one judge per concrete failure mode with pass/fail definitions and ≥ 20 + 20 labelled examples. | Problem exists (by design) | Kept for this submission: the scales are what the ground truth is expressed in, and matching the human rubric was the point. Designed follow-up: decompose the test axis into binary judges ("a graded test pins a name the issue never states", "tests reach beyond the reported scope", "an exact message string is asserted") and validate each with TPR/TNR. |
| **Code-based checks before LLM judges.** The audit asks whether any of the judged criteria can be checked mechanically. One can, partly: *does a graded test require an identifier the gold patch introduced that appears in neither the issue nor the repository at the base commit?* Measured on the 30 cases against the human `false_negative ≥ 2` label: **TNR 94%, TPR 17%** (graded tests only; 89% before scoping to FAIL_TO_PASS) — it catches the canonical case (`astropy-12544`: `mask_invalid`) almost for free and never fires on clean tasks, but most human "unfair test" labels are about scope, exact strings and behaviour choices, not names. | Partially applicable | Added as `src/code-check.ts` (`npm run code-check`): a precise, zero-cost pre-filter that a screening pipeline should run before spending an agent call, and a feature the test-probe could be handed. Not integrated into the reported runs. |
| **Error analysis grounded in traces, not brainstormed.** The failure categories in §6 (max-of-three labels; whole-patch vs FAIL_TO_PASS grading; ambiguous-by-rubric-but-solvable-by-code; context-induced leniency) were observed by reading trajectories against annotator notes. | OK | — |
| **Labelled data is small.** 30 cases; the audit's rule of thumb for stable TPR/TNR is ~50 + 50. Confidence intervals on every number here are wide (one case = 3 points), which the repeats made visible. | Problem exists | Same fix as the held-out set: the annotated pool has 1,669 more cases; cost, not data, is the constraint. |
| **Reviewers see full traces in a readable form.** Every run has a rendered Markdown trajectory (instructions → tool calls → probe reports → verification → verdict); the human labels are OpenAI's domain-expert annotators. | OK | — |

**Net effect on the claims.** Nothing in the audit changes a number; it changes how two of them are read. "Recall 70% → 75–85%" is now paired with "specificity 60% → 50–40%", and every headline figure carries the caveat that it was measured on the development set.

---

## 7. What existed before the hackathon, and what was built here

Existed before: the public SWE-bench dataset and construction pipeline (Jimenez et al., ICLR 2024;
github.com/SWE-bench/SWE-bench) and OpenAI's 2024 annotation file; the Claude Agent SDK and the Claude Code CLI; the general idea of probing a task for gameability / alternative solutions, which I had used in earlier
task-authoring work and which is also described in the public paper *Good Benchmarks* (Bercovich, arXiv 2607.12217).

Built during the hackathon (everything in this repository): the evaluation set construction and scorer, the
baseline, the four agent iterations and the cost experiment, the deterministic evidence verifier and retry loop, the
calibration memory, the trajectory recorder/renderer, and this report. No proprietary tooling or documents were used.

## 8. Ground rules

Public data only (SWE-bench, OpenAI annotations, MIT/BSD-licensed repositories at pinned commits); no credentials in
the repository; read-only tools, throwaway workspaces, no external side effects; a human reviewer is the intended
consumer of every verdict; every number in this README is produced by `npm run score` from files in `results/`.

## 9. Layout

```
src/screen.ts               screen ONE task (yours or a SWE-bench id)     skills/fairtask/       the screening skill (SKILL.md, method, PR script)
skills/fairtask-eval/       the evaluation skill (runs the scripts in-chat)
src/show.ts                 lay out one eval instance as readable files   examples/              committed screenings + the challenging case
src/run.ts                  run one system over the eval set
src/score.ts                metrics vs. human labels                     src/code-check.ts      zero-LLM pre-check for gold-only identifiers
src/variants/*.ts           baseline + every iteration (agent prompts)   src/report.ts          README tables from summary.json
src/lib/rubric.ts           the shared 0-3 rubric                        src/evidence-audit.ts  post-hoc verifier over any run
src/lib/verify.ts           deterministic evidence verifier              src/lib/calibration.ts per-repo human examples (v4-v6)
src/lib/run.ts              runner: resume, retries, fatal-stop, costs   src/trajectory-view.ts JSONL → Markdown
src/data/*.ts               eval-set / calibration / workspace builders  scripts/               render-trajectories, finalize-report
data/eval/instances.json    the 30 cases with human labels               results/<run>/         predictions, summary, run.log
trajectories/<run>/         one .jsonl + rendered .md per instance       REPRODUCE.md
```

