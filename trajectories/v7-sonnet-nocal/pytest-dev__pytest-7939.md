# Trajectory — pytest-dev__pytest-7939 — v7-sonnet-nocal (v7-sonnet-nocal)
Model: `claude-opus-5` · stratum: **unfair_tests** · human labels: underspecified=0, false_negative=2, filter_out=true

## Agent instructions
### Main agent system prompt
```text
You are screening a candidate task for a software-engineering benchmark.
A task = a GitHub issue + the repository at the commit before the fix + hidden tests from the fixing PR.
An engineer (or model) will be shown ONLY the issue text and the repository, must write a fix without asking
questions, and is then graded by applying the PR's test patch and running the FAIL_TO_PASS tests.

That setup is only fair if two assumptions hold. Score each on a 0-3 scale.

## Axis 1 — underspecified: is the issue text well-specified enough for a meaningful attempt?
Imagine an experienced engineer with full codebase access but no ability to ask for clarification.
- 0: The issue is well-specified and it is clear what is required for a successful solution.
- 1: There are some blanks to fill in, but there is a sensible interpretation of what is required.
- 2: The issue is vague and there is room for ambiguity. It is unclear what a successful solution would look like.
- 3: It is almost impossible to understand what you are being asked to do without further information.

## Axis 2 — false_negative: are the tests well-scoped so that ALL reasonable solutions to the issue pass?
The tests were written with one particular solution (the gold patch) in mind. The most common problem is a subtle
discrepancy between the tests and the issue text: the tests rely on a new function, parameter, variable name,
error message or exact output format that was introduced in the gold patch but is not mentioned in (or differs from)
the issue. Remember the engineer never sees the PR or the tests.
- 0: The tests perfectly cover all possible solutions.
- 1: The tests cover the majority of correct solutions; some unusual solutions may be missed.
- 2: The tests work, but some perfectly reasonable solutions would be missed by the tests.
- 3: The tests are too narrow/broad, or they look for something different than what the issue is about.

## Decision
"usable" if both scores are <= 1; otherwise "flag".

## Your role: judge
You do not investigate everything yourself. You dispatch two specialist probes, then decide.
1. Call the **spec-probe** and the **test-probe** subagents (both, in parallel, in the same turn). Pass each the full
   candidate task material verbatim (issue, gold patch, test patch, FAIL_TO_PASS) — they do not see your context.
2. Read both reports. For each probe, spot-check its strongest claim with your own Read/Grep before accepting it:
   open the cited location and confirm the quote is 
…[662 more chars]
```

### Subagent `spec-probe` (tools: Read, Grep, Glob)
```text
You are the specification probe for a benchmark-task screening pipeline. You receive a GitHub issue, the gold
patch and test patch from the PR that fixed it, and read-only access to the repository at the pre-fix commit (cwd).

Your single question: **Is the issue text well-specified enough for a meaningful attempt at a solution?**
Imagine an experienced engineer with full codebase access who cannot ask for clarification and never sees the PR.

Scale:
- 0: well-specified; it is clear what is required for a successful solution.
- 1: some blanks to fill in, but there is a sensible interpretation of what is required.
- 2: vague / ambiguous; unclear what a successful solution would look like.
- 3: almost impossible to understand what is being asked without further information.

Method:
1. Grep/Read the code the issue points at. Establish what a solver would need to decide: expected behaviour, scope
   (one case or the general case), edge cases, interface (names, types, errors), and which of several plausible
   interpretations is wanted.
2. For each open decision, check whether the codebase resolves it for a careful reader (existing conventions,
   docstrings, sibling functions, the reproduction in the issue). Only decisions the codebase does NOT resolve count.
3. Compare with what the gold patch actually did: if the gold patch made a choice the issue never implied and a
   different choice would have been equally faithful to the issue, that is ambiguity (raise the score); but do not
   penalise the issue for implementation details it reasonably left to the engineer.
4. Decide the score. Be calibrated: most real issues score 0-1; reserve 2 for genuine ambiguity about WHAT to build,
   3 for issues that cannot be understood.

Report format (markdown):
- **Score:** <0-3> — one-sentence summary
- **Evidence:** bullet list; each bullet = a claim, then the location (repo path with line range like `pkg/mod.py:L40-L52`, or `test_patch` / `gold_patch` / `issue`), then a verbatim quote (<= 300 chars) from that location.
- **What would change my mind:** one or two sentences.
Quotes must be verbatim — they will be checked against the files. You may elide lines with "..." between verbatim fragments.
```

### Subagent `test-probe` (tools: Read, Grep, Glob)
```text
You are the test-scope probe for a benchmark-task screening pipeline. You receive a GitHub issue, the gold patch
and test patch from the PR that fixed it, and read-only access to the repository at the pre-fix commit (cwd).

Your single question: **Would ALL reasonable solutions to the issue pass these tests, or do the tests depend on
choices that only the gold patch made?** The solver sees only the issue and the repo — never the PR or the tests.

Scale:
- 0: the tests perfectly cover all possible solutions.
- 1: the tests cover the majority of correct solutions; some unusual solutions may be missed.
- 2: the tests work, but some perfectly reasonable solutions would be missed.
- 3: the tests are too narrow/broad, or test something different from what the issue is about.

Method:
1. Read the test patch against the actual test files in the repo (Read the file, find where the hunk lands, understand
   the fixtures and helpers it relies on).
2. For EVERY new or changed assertion, extract what it pins down: function/parameter/attribute names, argument order,
   return values and types, exception classes, exact message wording, output formatting, warning categories, call
   counts. For each, answer: is this stated (or unambiguously implied) by the issue text? Or does it exist only because
   the gold patch chose it? Check the repo for existing conventions that would make the gold patch's choice the only
   natural one (Grep for sibling APIs with the same naming pattern) — a convention-following name is not a discrepancy.
3. Write down at least two concrete alternative fixes a competent engineer could produce from the issue alone (e.g.
   a different parameter name, a different error type, fixing at a different layer, handling only the reported case,
   returning a different but equally valid value). For each, trace whether the FAIL_TO_PASS tests would pass.
4. Also check the other direction: do the tests actually test what the issue is about, or something adjacent?
5. Decide the score. A single test-pinned name/message the issue never mentions is typically a 2 (a reasonable
   alternative fails); tests that require a different feature than the issue describes are a 3.

Report format (markdown):
- **Score:** <0-3> — one-sentence summary
- **Evidence:** bullet list; each bullet = a claim, then the location (repo path with line range like `pkg/mod.py:L40-L52`, or `test_patch` / `gold_patch` / `issue`), then a verbatim quote (<= 300 chars) from that location.
- **Wha
…[172 more chars]
```

### Task prompt
```text
# Candidate task: pytest-dev__pytest-7939
Repository: pytest-dev/pytest @ 65e6e39b76c236999fc53823892c26367a85a8f8 (version 6.2)

## Issue text (this is ALL the solver will see)
<issue>
[Feature] Allow a --sw-skip shorthand cli arg like --sw itself permits
The stepwise plugin exposes a shorthand option for the stepwise itself, however it requires a longer arg only for skip, I think these should be consistent and should offer shorthand versions for both.

'''python
def pytest_addoption(parser: Parser) -> None:
    group = parser.getgroup("general")
    group.addoption(
        "--sw",
        "--stepwise",
        action="store_true",
        dest="stepwise",
        help="exit on test failure and continue from last failing test next time",
    )
    group.addoption(
        "--stepwise-skip",
        action="store_true",
        dest="stepwise_skip",
        help="ignore the first failing test but stop on the next failing test",
    )
'''

Expected:
`pytest --sw-skip`
</issue>

## Gold patch (the original PR's code change — the solver does NOT see this)
<gold_patch>
diff --git a/src/_pytest/stepwise.py b/src/_pytest/stepwise.py
--- a/src/_pytest/stepwise.py
+++ b/src/_pytest/stepwise.py
@@ -1,5 +1,6 @@
 from typing import List
 from typing import Optional
+from typing import TYPE_CHECKING
 
 import pytest
 from _pytest import nodes
@@ -8,6 +9,11 @@
 from _pytest.main import Session
 from _pytest.reports import TestReport
 
+if TYPE_CHECKING:
+    from _pytest.cacheprovider import Cache
+
+STEPWISE_CACHE_DIR = "cache/stepwise"
+
 
 def pytest_addoption(parser: Parser) -> None:
     group = parser.getgroup("general")
@@ -15,12 +21,15 @@ def pytest_addoption(parser: Parser) -> None:
         "--sw",
         "--stepwise",
         action="store_true",
+        default=False,
         dest="stepwise",
         help="exit on test failure and continue from last failing test next time",
     )
     group.addoption(
+        "--sw-skip",
         "--stepwise-skip",
         action="store_true",
+        default=False,
         dest="stepwise_skip",
         help="ignore the first failing test but stop on the next failing test",
     )
@@ -28,63 +37,56 @@ def pytest_addoption(parser: Parser) -> None:
 
 @pytest.hookimpl
 def pytest_configure(config: Config) -> None:
-    config.pluginmanager.register(StepwisePlugin(config), "stepwiseplugin")
+    # We should always have a cache as cache provider plugin uses tryfirst=True
+    if config.getoption("stepwise"):
+        config.pluginmanager.register(StepwisePlugin(config), "stepwiseplugin")
+
+
+def pytest_sessionfinish(session: Session) -> None:
+    if not session.config.getoption("stepwise"):
+        assert session.config.cache is not None
+        # Clear the list of failing tests if the plugin is not active.
+        session.config.cache.set(STEPWISE_CACHE_DIR, [])
 
 
 class StepwisePlugin:
     def __init__(self, config: Config) -> None:
         self.config = config
-        sel
…[5563 more chars]
```

## Execution

- **session** `3e156464-461e-4387-aa3f-5a48596155f4` · tools: Task, Glob, Grep, Read, StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup, spec-probe, test-probe

**judge/main:** I'll dispatch both probes in parallel.

#### judge/main → dispatch `spec-probe` (Assess issue specification)
```text
Assess whether this issue is well-specified enough for an engineer with full repo access (pytest-dev/pytest @ 65e6e39b76c236999fc53823892c26367a85a8f8) but no ability to ask questions.

## Issue text (ALL the solver sees)
[Feature] Allow a --sw-skip shorthand cli arg like --sw itself permits

The stepwise plugin exposes a shorthand option for the stepwise itself, however it requires a longer arg only for skip, I think these should be consistent and should offer shorthand versions for both.

'''python
def pytest_addoption(parser: Parser) -> None:
    group = parser.getgroup("general")
    group.addoption(
        "--sw",
        "--stepwise",
        action="store_true",
        dest="stepwise",
        help="exit on test failure and continue from last failing test next time",
    )
    gro
…[1314 more chars]
```


- subagent:spec-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/pytest-dev__pytest-7939/repo/src/_pytest/stepwise.py"}
```
  - ↩ result:
```text
1	from typing import List
2	from typing import Optional
3	
4	import pytest
5	from _pytest import nodes
6	from _pytest.config import Config
7	from _pytest.config.argparsing import Parser
8	from _pytest.main import Session
9	from _pytest.reports import TestReport
10	
11	
12	def pytest_addoption(parser: Parser) -> None:
13	    group = parser.getgroup("general")
14	    group.addoption(
15	        "--sw",
16	        "--stepwise",
17	        action="store_true",
18	        dest="stepwise",
19	        help="exit on test failure and continue from last failing test next time",
20	    )
21	    group.addoption(
22	        "--stepwise-skip",
23	        action="store_true",
24	        dest="stepwise_skip
…[3846 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"stepwise_skip|--sw-skip|run_with_skip_option","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/pytest-dev__pytest-7939/repo/testing/test_stepwise.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
120:def test_run_with_skip_option(stepwise_testdir):
```


- subagent:spec-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/pytest-dev__pytest-7939/repo/testing/test_stepwise.py","offset":100,"limit":40}
```
  - ↩ result:
```text
100	    )
101	    assert _strip_resource_warnings(result.stderr.lines) == []
102	
103	    stdout = result.stdout.str()
104	    # Make sure we stop after first failing test.
105	    assert "test_success_before_fail PASSED" in stdout
106	    assert "test_fail_on_flag FAILED" in stdout
107	    assert "test_success_after_fail" not in stdout
108	
109	    # "Fix" the test that failed in the last run and run it again.
110	    result = stepwise_testdir.runpytest("-v", "--strict-markers", "--stepwise")
111	    assert _strip_resource_warnings(result.stderr.lines) == []
112	
113	    stdout = result.stdout.str()
114	    # Make sure the latest failing test runs and then continues.
115	    assert "test_su
…[883 more chars]
```


#### judge/main → dispatch `test-probe` (Assess test scoping)
```text
Assess whether the hidden tests accept all reasonable solutions to this issue. Repo: pytest-dev/pytest @ 65e6e39b76c236999fc53823892c26367a85a8f8.

## Issue text (ALL the solver sees)
[Feature] Allow a --sw-skip shorthand cli arg like --sw itself permits

The stepwise plugin exposes a shorthand option for the stepwise itself, however it requires a longer arg only for skip, I think these should be consistent and should offer shorthand versions for both.

'''python
def pytest_addoption(parser: Parser) -> None:
    group = parser.getgroup("general")
    group.addoption("--sw", "--stepwise", action="store_true", dest="stepwise", help="...")
    group.addoption("--stepwise-skip", action="store_true", dest="stepwise_skip", help="...")
'''

Expected:
`pytest --sw-skip`

## Gold patch (solver does
…[2139 more chars]
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/pytest-dev__pytest-7939/repo/src/_pytest/stepwise.py"}
```
  - ↩ result:
```text
1	from typing import List
2	from typing import Optional
3	
4	import pytest
5	from _pytest import nodes
6	from _pytest.config import Config
7	from _pytest.config.argparsing import Parser
8	from _pytest.main import Session
9	from _pytest.reports import TestReport
10	
11	
12	def pytest_addoption(parser: Parser) -> None:
13	    group = parser.getgroup("general")
14	    group.addoption(
15	        "--sw",
16	        "--stepwise",
17	        action="store_true",
18	        dest="stepwise",
19	        help="exit on test failure and continue from last failing test next time",
20	    )
21	    group.addoption(
22	        "--stepwise-skip",
23	        action="store_true",
24	        dest="stepwise_skip
…[3846 more chars]
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/pytest-dev__pytest-7939/repo/testing/test_stepwise.py"}
```
  - ↩ result:
```text
1	import pytest
2	
3	
4	@pytest.fixture
5	def stepwise_testdir(testdir):
6	    # Rather than having to modify our testfile between tests, we introduce
7	    # a flag for whether or not the second test should fail.
8	    testdir.makeconftest(
9	        """
10	def pytest_addoption(parser):
11	    group = parser.getgroup('general')
12	    group.addoption('--fail', action='store_true', dest='fail')
13	    group.addoption('--fail-last', action='store_true', dest='fail_last')
14	"""
15	    )
16	
17	    # Create a simple test suite.
18	    testdir.makepyfile(
19	        test_a="""
20	def test_success_before_fail():
21	    assert 1
22	
23	def test_fail_on_flag(request):
24	    assert not request.con
…[5324 more chars]
```

  - ↩ result (subagent report):
```text
## Assessment

**Score:** 0 — the issue is a simple, self-contained, unambiguous feature request with the exact fix explicit in the text.

**Evidence:**
- Issue directly quotes the current `pytest_addoption` code and states the specific expected CLI: `issue`, `"Expected: pytest --sw-skip"`, alongside the shown code block containing `group.addoption("--stepwise-skip", ...)`.
- The existing sibling option in the repo already demonstrates the exact pattern to replicate (adding a second positional alias string to `addoption`): `src/_pytest/stepwise.py:L14-L20`, `group.addoption(\n        "--sw",\n        "--stepwise",\n        action="store_true",\n        dest="stepwise",`.
- The option needing the analogous alias is immediately below it with an identical structure, making the required change (`"--sw-skip"` alongside `"--stepwise-skip"`) mechanically obvious: `src/_pytest/stepwise.py:L21-L26`, `group.addoption(\n        "--stepwise-skip",\n        action="store_true",\n        dest="stepwise_skip",`.
- The FAIL_TO_PASS test confirms the sole required behavior is that `--sw-skip` behaves identically to `--stepwise-skip` in the existing skip test, with no new semantics: `testing/test_stepwise.py:L120-L128`, `result = stepwise_testdir.runpytest(\n        "-v",\n        "--strict-markers",\n        "--stepwise",\n        "--stepwise-skip",\n        "--fail",\n        "--fail-last",\n    )` (parametrized in the gold test_patch to also use `--sw-skip`).
- The gold patch's extra refactoring (STEPWISE_CACHE_DIR constant, conditional plugin registration, `pytest_collection_modifyitems` rewrite, report-status wording) is not implied or required by the issue text or the FAIL_TO_PASS test — it is incidental cleanup bundled into the same PR, not something the issue asks for or that is needed to satisfy the stated request.

**What would change my mind:** If the FAIL_TO_PASS/expected test suite required behavioral changes beyond the alias (e.g., new report-status wording, deselection-count messaging, or plugin registration changes) that were not derivable from the issue text, that would indicate real ambiguity — but the only failing test tied to this issue is the trivial `--sw-skip` alias parametrization.
agentId: a0f492ec1eab9e129 (use SendMessage with to: 'a0f492ec1eab9e129', summary: '<5-10 word recap>' to continue this agent)
<usage>subagent_tokens: 9686
tool_uses: 3
duration_ms: 19368</usage>
```

  - ↩ result (subagent report):
```text
## Assessment

**Score: 0** — The tests map essentially 1:1 onto the issue's explicit request; any reasonable implementation of the feature satisfies the FAIL_TO_PASS test.

### Reasoning

1. **Minimal fix passes.** The current `pytest_addoption` in `src/_pytest/stepwise.py` (lines 21-26) is:
'''
group.addoption(
    "--stepwise-skip",
    action="store_true",
    dest="stepwise_skip",
    help="ignore the first failing test but stop on the next failing test",
)
'''
A trivial change — just adding `"--sw-skip"` as an additional flag string in the same `addoption` call (keeping `dest="stepwise_skip"`) — is sufficient. Nothing else in the gold patch's refactor (STEPWISE_CACHE_DIR constant, conditional plugin registration, f-string, collection logic rewrite) is exercised by the FAIL_TO_PASS test.

2. **The FAIL_TO_PASS test only checks the alias works.** `testing/test_stepwise.py`'s parametrized test:
'''python
@pytest.mark.parametrize("stepwise_skip", ["--stepwise-skip", "--sw-skip"])
def test_run_with_skip_option(stepwise_testdir, stepwise_skip):
    result = stepwise_testdir.runpytest("-v", "--strict-markers", "--stepwise", stepwise_skip, "--fail", "--fail-last")
'''
just re-runs the pre-existing skip-flow assertions (`"test_fail_on_flag FAILED" in stdout`, etc., lines 132-136) with `--sw-skip` substituted for `--stepwise-skip`. It only verifies the new flag toggles the same `stepwise_skip` boolean — exactly what the issue asks for.

3. **The issue itself pins the exact flag name**, removing the usual "arbitrary gold-patch naming choice" ambiguity: `issue` states *"Expected: `pytest --sw-skip`"* verbatim, so the test's use of `"--sw-skip"` is directly dictated by the issue text, not an unstated gold-patch preference.

4. **`test_stepwise_output_summary` (not in FAIL_TO_PASS) is unrelated and already passes pre-patch.** Its assertions (`"stepwise: no previously failed tests, not skipping."`, `"stepwise: skipping 4 already passed items."`) match the pre-patch `pytest_report_collectionfinish`/`pytest_collection_modifyitems` logic verbatim (`src/_pytest/stepwise.py:55,75-77,111-113`), confirming it is a regression-preservation test for the larger refactor, not a hidden requirement tied to the `--sw-skip` feature. It correctly is excluded from FAIL_TO_PASS.

5. No PASS_TO_PASS test depends on the refactor internals (cache dir constant, conditional registration) in a way that a minimal alias-only fix would break — the minimal fix changes nothing else about program behavior.

### What would change my mind
If FAIL_TO_PASS also included `test_stepwise_output_summary` or any assertion that depended on the refactor's internal structure (e.g., asserting the plugin is *not* registered when `--stepwise` is absent, or asserting the `STEPWISE_CACHE_DIR` constant/cache-clearing behavior), that would penalize solutions that only added the CLI alias without replicating the refactor — but that is not the case here.

Relevant files reviewed:
- `/Users/manoskaparos/Pro
…[385 more chars]
```


**judge/main:** Both probes score 0. Let me spot-check the key claims myself.

- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/pytest-dev__pytest-7939/repo/src/_pytest/stepwise.py","limit":40}
```
  - ↩ result:
```text
1	from typing import List
2	from typing import Optional
3	
4	import pytest
5	from _pytest import nodes
6	from _pytest.config import Config
7	from _pytest.config.argparsing import Parser
8	from _pytest.main import Session
9	from _pytest.reports import TestReport
10	
11	
12	def pytest_addoption(parser: Parser) -> None:
13	    group = parser.getgroup("general")
14	    group.addoption(
15	        "--sw",
16	        "--stepwise",
17	        action="store_true",
18	        dest="stepwise",
19	        help="exit on test failure and continue from last failing test next time",
20	    )
21	    group.addoption(
22	        "--stepwise-skip",
23	        action="store_true",
24	        dest="stepwise_skip
…[508 more chars]
```


- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/pytest-dev__pytest-7939/repo/testing/test_stepwise.py","offset":110,"limit":35}
```
  - ↩ result:
```text
110	    result = stepwise_testdir.runpytest("-v", "--strict-markers", "--stepwise")
111	    assert _strip_resource_warnings(result.stderr.lines) == []
112	
113	    stdout = result.stdout.str()
114	    # Make sure the latest failing test runs and then continues.
115	    assert "test_success_before_fail" not in stdout
116	    assert "test_fail_on_flag PASSED" in stdout
117	    assert "test_success_after_fail PASSED" in stdout
118	
119	
120	def test_run_with_skip_option(stepwise_testdir):
121	    result = stepwise_testdir.runpytest(
122	        "-v",
123	        "--strict-markers",
124	        "--stepwise",
125	        "--stepwise-skip",
126	        "--fail",
127	        "--fail-last",
128	    
…[663 more chars]
```


**judge/main:** Both probes confirmed by spot-check: the issue explicitly names the exact flag (`pytest --sw-skip`), the repo's existing `--sw`/`--stepwise` alias pattern shows the mechanical fix, and the FAIL_TO_PASS test merely re-parametrizes the pre-existing `test_run_with_skip_option` assertions with the new flag. The gold patch's larger refactor is incidental and not exercised by the FAIL_TO_PASS test (`test_stepwise_output_summary` is excluded from it).

#### judge/main → **final verdict**
```json
{
  "underspecified": 0,
  "underspecified_rationale": "The issue quotes the exact function to change (`pytest_addoption` in src/_pytest/stepwise.py) and states the precise desired CLI flag: \"Expected: `pytest --sw-skip`\". The repo already shows the identical alias pattern one call above (`\"--sw\", \"--stepwise\"` on the same addoption), so the required edit — adding `\"--sw-skip\"` alongside `\"--stepwise-skip\"` while keeping `dest=\"stepwise_skip\"` — is unambiguous and mechanically obvious. No hidden semantics or design choices are left to the solver.",
  "false_negative": 0,
  "false_negative_rationale": "The sole FAIL_TO_PASS test, test_run_with_skip_option[--sw-skip], is the pre-existing test parametrized over [\"--stepwise-skip\", \"--sw-skip\"]; its assertions (\"test_fail_on_flag FAILED\" in stdout, \"test_fail_last_on_flag FAILED\" in stdout, etc.) are unchanged and only verify the new flag toggles the same stepwise_skip boolean. A minimal one-line alias addition passes. The flag name itself is dictated verbatim by the issue, so there is no unstated naming coupling. The gold patch's refactor (STEPWISE_CACHE_DIR, conditional plugin registration, failed_index slicing) is not exercised by the FAIL_TO_PASS test, and test_stepwise_output_summary — which asserts the report-status strings — is deliberately excluded from FAIL_TO_PASS and matches the pre-patch messages anyway.",
  "evidence": [
    {
      "axis": "underspecified",
      "source": "issue",
      "ref": "issue",
      "claim": "The issue names the exact CLI flag to add, removing naming ambiguity.",
      "quote": "Expected:\n`pytest --sw-skip`"
    },
    {
      "axis": "false_negative",
      "source": "repo",
      "ref": "src/_pytest/stepwise.py:L12-L26",
      "claim": "The repo already contains the exact alias pattern to replicate, so the minimal fix is a one-line addition to the same addoption call.",
      "quote": "        \"--sw\",\n        \"--stepwise\",\n        action=\"store_true\",\n        dest=\"stepwise\","
    },
    {
      "axis": "false_negative",
      "source": "test_patch",
      "ref": "testing/test_stepwise.py",
      "claim": "The FAIL_TO_PASS test is just the existing test parametrized over the two flag spellings, reusing unchanged assertions.",
      "quote": "@pytest.mark.parametrize(\"stepwise_skip\", [\"--stepwise-skip\", \"--sw-skip\"])\n+def test_run_with_skip_option(stepwise_testdir, stepwise_skip):"
    }
  ],
  "decision": "usable",
  "confidence": 5
}
```


## Result
- subtype: success · turns: 6 · 107s · cost $0.304 · tokens in/out/cache: 6/4061/34296

### ✅ Verification passed