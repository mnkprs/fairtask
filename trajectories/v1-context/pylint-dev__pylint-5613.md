# Trajectory — pylint-dev__pylint-5613 — v1-context (v1-context)
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

## How to investigate (you have read-only access to the repository at the base commit; cwd is the repo root)
Do not score from the issue and patches alone — the human annotators had the codebase open, and so do you.
1. Locate the code the issue is about (Grep for the symbols, paths and messages it mentions). Read enough of it to
   know what a solver would actually have to change.
2. Read the test patch against the real test files. For every new/changed assertion, ask: does the issue text tell the
   solve
…[1119 more chars]
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
…[549 more chars]
```

## Execution

- **session** `b2a03975-0cce-430a-9c90-8a6a153ced2b` · tools: Glob, Grep, Read, StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup

- judge/main → `Read` ```json
{"file_path":"/repo/pylint/__init__.py"}
```
  - ❌ error:
```text
File does not exist. Note: your current working directory is /Users/manoskaparos/Projects/taskprobe/workspaces/pylint-dev__pylint-5613/repo.
```


- judge/main → `Read` ```json
{"file_path":"/repo/tests/test_pylint_runners.py"}
```
  - ❌ error:
```text
File does not exist. Note: your current working directory is /Users/manoskaparos/Projects/taskprobe/workspaces/pylint-dev__pylint-5613/repo.
```


- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/pylint-dev__pylint-5613/repo/pylint/__init__.py"}
```
  - ↩ result:
```text
1	# Copyright (c) 2008, 2012 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
2	# Copyright (c) 2014, 2016-2020 Claudiu Popa <pcmanticore@gmail.com>
3	# Copyright (c) 2014 Arun Persaud <arun@nubati.net>
4	# Copyright (c) 2015 Ionel Cristian Maries <contact@ionelmc.ro>
5	# Copyright (c) 2018 Nick Drozd <nicholasdrozd@gmail.com>
6	# Copyright (c) 2020-2021 Pierre Sassoulas <pierre.sassoulas@gmail.com>
7	# Copyright (c) 2021 Marc Mueller <30130371+cdce8p@users.noreply.github.com>
8	
9	# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
10	# For details: https://github.com/PyCQA/pylint/blob/main/LICENSE
11	
12	import os
13	import sys
14	
15	from pylint.__pkginfo__ i
…[2124 more chars]
```


- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/pylint-dev__pylint-5613/repo/tests/test_pylint_runners.py"}
```
  - ↩ result:
```text
1	# pylint: disable=missing-module-docstring, missing-function-docstring
2	import os
3	import sys
4	from typing import Callable
5	from unittest.mock import patch
6	
7	import pytest
8	from py._path.local import LocalPath  # type: ignore[import]
9	
10	from pylint import run_epylint, run_pylint, run_pyreverse, run_symilar
11	
12	
13	@pytest.mark.parametrize(
14	    "runner", [run_epylint, run_pylint, run_pyreverse, run_symilar]
15	)
16	def test_runner(runner: Callable, tmpdir: LocalPath) -> None:
17	    filepath = os.path.abspath(__file__)
18	    testargs = ["", filepath]
19	    with tmpdir.as_cwd():
20	        with patch.object(sys, "argv", testargs):
21	            with pytest.raises(SystemEx
…[85 more chars]
```


- judge/main → `Grep` ```json
{"pattern":"arguments|run_pyreverse","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/pylint-dev__pylint-5613/repo/doc/whatsnew/2.13.rst","output_mode":"content"}
```
  - ↩ result:
```text
No matches found
```


#### judge/main → **final verdict**
```json
{
  "underspecified": 2,
  "underspecified_rationale": "The issue is a feature request phrased as a wish (\"Please provide a better entry point to pyreverse\") whose \"Desired solution\" is a concrete but different API from what was actually implemented: `pylint.pyreverse(output=pylint.PNG, project=name, files=files)` with module-level format constants. The issue gives no indication of the accepted design (a keyword-only `arguments: Optional[List[str]]` parameter added to `run_pylint`, `run_pyreverse` and `run_symilar` in pylint/__init__.py, lines 20-46). Nothing in the issue mentions run_pylint or run_symilar at all, nor which pyreverse options (`-o`, `-p`, `-a`, ...) must be exposed, whether `pylint.PNG` constants must exist, or what the function should return / whether it should still raise SystemExit. The repository at base commit gives no convention hint either (no existing `arguments=` parameter on any Run class). A careful engineer can infer the underlying need (avoid mutating sys.argv), but the concrete shape of an acceptable solution is genuinely ambiguous.",
  "false_negative": 3,
  "false_negative_rationale": "The hidden test asserts `runner(arguments=testargs)` for all three of `run_pylint`, `run_pyreverse`, `run_symilar`, where `testargs` is a plain list of CLI-style strings. That exact keyword name `arguments` and the list-of-CLI-args design exist only in the gold patch; the issue instead asks for `pylint.pyreverse(output=pylint.PNG, project=name, files=files)`. A solver who implements literally what the issue requests (a new `pylint.pyreverse(output=..., project=..., files=...)` helper plus `pylint.PNG`) fails every FAIL_TO_PASS test, since `run_pyreverse` would still take no parameters. Even a solver who chooses the arg-list approach could reasonably name the parameter `args`, `argv`, or make it positional (`run_pyreverse(args=None)`), which also fails on `runner(arguments=...)`. Additionally, the test extends the requirement to `run_pylint` and `run_symilar`, which the issue never mentions, so a fix scoped to pyreverse only (the reported case) fails 2 of 3 tests. The tests also depend on the runners still calling `sys.exit(0)` and on the helper being importable as before, which is fine, but the parameter-name coupling is the decisive mismatch.",
  "evidence": [
    {
      "axis": "false_negative",
      "claim": "The hidden test requires a keyword parameter literally named `arguments` on all three runners.",
      "source": "test_patch",
      "ref": "tests/test_pylint_runners.py",
      "quote": "@pytest.mark.parametrize(\"runner\", [run_pylint, run_pyreverse, run_symilar])\ndef test_runner_with_arguments(runner: Callable, tmpdir: LocalPath) -> None:\n    \"\"\"Check the runners with arguments as parameter instead of sys.argv\"\"\"\n    ...\n            runner(arguments=testargs)"
    },
    {
      "axis": "false_negative",
      "claim": "The issue's requested API is a keyword API with output/project/files and a PNG constant, not a CLI argument list, so implementing the issue as written fails the tests.",
      "source": "issue",
      "ref": "issue",
      "quote": "pylint.pyreverse(output=pylint.PNG, project=name, files=files)"
    },
    {
      "axis": "false_negative",
      "claim": "The issue only concerns pyreverse, but the tests also require run_pylint and run_symilar to accept `arguments`.",
      "source": "issue",
      "ref": "issue",
      "quote": "Please provide a better entry point to pyreverse"
    },
    {
      "axis": "underspecified",
      "claim": "At the base commit the runners take no parameters and there is no existing convention naming such a parameter, leaving the design open.",
      "source": "repo",
      "ref": "pylint/__init__.py:L35-L46",
      "quote": "def run_pyreverse():\n    \"\"\"run pyreverse\"\"\"\n    from pylint.pyreverse.main import Run as PyreverseRun\n\n    PyreverseRun(sys.argv[1:])"
    }
  ],
  "decision": "flag",
  "confidence": 4
}
```


## Result
- subtype: success · turns: 7 · 38s · cost $0.142 · tokens in/out/cache: 8/2955/27035

### ✅ Verification passed