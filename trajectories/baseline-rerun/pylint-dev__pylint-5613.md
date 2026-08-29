# Trajectory — pylint-dev__pylint-5613 — baseline (baseline-rerun)
Model: `claude-opus-5` · stratum: **unfair_tests** · human labels: underspecified=1, false_negative=3, filter_out=true

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

Answer with a JSON verdict matching the required schema.
```

### Task prompt
```text
# Candidate task: pylint-dev__pylint-5613
Repository: pylint-dev/pylint @ 019794b808271d45f86a7014e9c91cb04458a47a (version 2.13)

## Issue text (this is ALL the solver will see)
<issue>
Please provide a better entry point to pyreverse
### Current problem

Currently, I have to do:
'''python
import pylint

# Set name.
# Collect filenames in files...

sys.argv = 'pyreverse -o png -p'.split() + [name] + files
try:
    pylint.run_pyreverse()
except SystemExit:
    pass  # pylint always does this.
'''

### Desired solution

I would like to do something like:
'''python
import pylint

pylint.pyreverse(output=pylint.PNG, project=name, files=files)
'''
</issue>

## Gold patch (the original PR's code change — the solver does NOT see this)
<gold_patch>
diff --git a/pylint/__init__.py b/pylint/__init__.py
--- a/pylint/__init__.py
+++ b/pylint/__init__.py
@@ -11,17 +11,22 @@
 
 import os
 import sys
+from typing import List, Optional
 
 from pylint.__pkginfo__ import __version__
 
 # pylint: disable=import-outside-toplevel
 
 
-def run_pylint():
+def run_pylint(*, arguments: Optional[List[str]] = None):
+    """Run pylint
+
+    Arguments can be a list of strings normally supplied as arguments on the command line
+    """
     from pylint.lint import Run as PylintRun
 
     try:
-        PylintRun(sys.argv[1:])
+        PylintRun(arguments or sys.argv[1:])
     except KeyboardInterrupt:
         sys.exit(1)
 
@@ -32,18 +37,24 @@ def run_epylint():
     EpylintRun()
 
 
-def run_pyreverse():
-    """run pyreverse"""
+def run_pyreverse(*, arguments: Optional[List[str]] = None):
+    """Run pyreverse
+
+    Arguments can be a list of strings normally supplied as arguments on the command line
+    """
     from pylint.pyreverse.main import Run as PyreverseRun
 
-    PyreverseRun(sys.argv[1:])
+    PyreverseRun(arguments or sys.argv[1:])
+
 
+def run_symilar(*, arguments: Optional[List[str]] = None):
+    """Run symilar
 
-def run_symilar():
-    """run symilar"""
+    Arguments can be a list of strings normally supplied as arguments on the command line
+    """
     from pylint.checkers.similar import Run as SimilarRun
 
-    SimilarRun(sys.argv[1:])
+    SimilarRun(arguments or sys.argv[1:])
 
 
 def modify_sys_path() -> None:
</gold_patch>

## Test patch (the hidden tests applied to the solver's code — the solver does NOT see this)
<test_patch>
diff --git a/tests/test_pylint_runners.py b/tests/test_pylint_runners.py
--- a/tests/test_pylint_runners.py
+++ b/tests/test_pylint_runners.py
@@ -21,3 +21,14 @@ def test_runner(runner: Callable, tmpdir: LocalPath) -> None:
             with pytest.raises(SystemExit) as err:
                 runner()
             assert err.value.code == 0
+
+
+@pytest.mark.parametrize("runner", [run_pylint, run_pyreverse, run_symilar])
+def test_runner_with_arguments(runner: Callable, tmpdir: LocalPath) -> None:
+    """Check the runners with arguments as parameter instead of sys.argv"""
+    filepath = os.path.ab
…[545 more chars]
```

## Execution

- **session** `77a6bc70-e7d8-4cdf-b1d8-0bb8d688504e` · tools: StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup

#### judge/main → **final verdict**
```json
{
  "claim": "x"
}
```

  - ⚠️ schema rejected: Output does not match required schema: root: must have required property 'underspecified', root: must have required property 'underspecified_rationale', root: must have required property 'false_negative', root: must have required property 'false_negative_rationale', root: must have required property
…[148 more chars]

#### judge/main → **final verdict**
```json
{
  "underspecified": 2,
  "underspecified_rationale": "The issue is an open-ended feature request (\"Please provide a better entry point to pyreverse\") whose only concrete proposal is a high-level API `pylint.pyreverse(output=pylint.PNG, project=name, files=files)` with named constants like `pylint.PNG`. It gives no indication of the actually-adopted design (a keyword-only `arguments: Optional[List[str]]` parameter added to `run_pylint`, `run_pyreverse` and `run_symilar` in `pylint/__init__.py`), nor that the change should extend to the pylint and symilar runners at all. A solver cannot tell whether they should implement the literal proposed `pyreverse(output=..., project=..., files=...)` signature, a keyword-argument list passthrough, or something else, so it is unclear what a successful solution looks like.",
  "false_negative": 3,
  "false_negative_rationale": "The hidden test `test_runner_with_arguments` calls `runner(arguments=testargs)` for `run_pylint`, `run_pyreverse` and `run_symilar` — it requires the exact keyword name `arguments`, a list-of-CLI-strings signature, and that the change be applied to all three runners. None of this appears in the issue, which asks for `pylint.pyreverse(output=pylint.PNG, project=name, files=files)` and mentions only pyreverse. A solver who faithfully implements the requested high-level `pylint.pyreverse(output=..., project=..., files=...)` API (a perfectly reasonable, indeed literal, reading of the issue) would fail all three FAIL_TO_PASS tests, as would anyone naming the parameter `args`/`argv` or touching only pyreverse.",
  "evidence": [
    {
      "axis": "underspecified",
      "source": "issue",
      "ref": "issue",
      "claim": "The issue only proposes a high-level keyword API for pyreverse with symbolic constants, giving no hint about a CLI-argument list passthrough or about the other runners.",
      "quote": "I would like to do something like:\n'''python\nimport pylint\n\npylint.pyreverse(output=pylint.PNG, project=name, files=files)\n'''"
    },
    {
      "axis": "false_negative",
      "source": "test_patch",
      "ref": "tests/test_pylint_runners.py",
      "claim": "Tests require the exact keyword-only parameter name `arguments` taking a list of CLI-style strings, for all three runners.",
      "quote": "@pytest.mark.parametrize(\"runner\", [run_pylint, run_pyreverse, run_symilar])\ndef test_runner_with_arguments(runner: Callable, tmpdir: LocalPath) -> None:\n    ...\n            runner(arguments=testargs)"
    },
    {
      "axis": "false_negative",
      "source": "gold_patch",
      "ref": "pylint/__init__.py",
      "claim": "The gold solution's design (keyword-only `arguments` list on run_pylint/run_pyreverse/run_symilar) differs substantially from the API requested in the issue.",
      "quote": "def run_pyreverse(*, arguments: Optional[List[str]] = None):\n    \"\"\"Run pyreverse\n\n    Arguments can be a list of strings normally supplied as arguments on the command line\n    \"\"\""
    }
  ],
  "decision": "flag",
  "confidence": 4
}
```


## Result
- subtype: success · turns: 3 · 19s · cost $0.069 · tokens in/out/cache: 4/1613/5710

### ✅ Verification passed