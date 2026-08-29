# Trajectory — astropy__astropy-12544 — baseline (baseline)
Model: `claude-opus-5` · stratum: **unfair_tests** · human labels: underspecified=0, false_negative=3, filter_out=true

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
# Candidate task: astropy__astropy-12544
Repository: astropy/astropy @ 3a0cd2d8cd7b459cdc1e1b97a14f3040ccc1fffc (version 4.3)

## Issue text (this is ALL the solver will see)
<issue>
Can Table masking be turned off?
<!-- This comments are hidden when you submit the issue,
so you do not need to remove them! -->

<!-- Please be sure to check out our contributing guidelines,
https://github.com/astropy/astropy/blob/main/CONTRIBUTING.md .
Please be sure to check out our code of conduct,
https://github.com/astropy/astropy/blob/main/CODE_OF_CONDUCT.md . -->

<!-- Please have a search on our GitHub repository to see if a similar
issue has already been posted.
If a similar issue is closed, have a quick look to see if you are satisfied
by the resolution.
If not please go ahead and open an issue! -->

### Description
<!-- Provide a general description of the feature you would like. -->
<!-- If you want to, you can suggest a draft design or API. -->
<!-- This way we have a deeper discussion on the feature. -->

As of Astropy 5, when `astropy.table.Table.read()` encounters values such as `NaN`, it automatically creates a `MaskedColumn` and the whole table becomes a `MaskedTable`.  While this might be useful for individual end-users, it is very inconvenient for intermediate data in pipelines.

Here's the scenario: data are being passed via files and `Table.read()`.  A downstream function needs to replace `NaN` with valid values.  Previously those values could be easily identified (*e.g.* `np.isnan()` and replaced.  However, now additional work is need to look "underneath" the mask, extracting the actual values, replacing them, and then possibly creating a new, unmasked column, or even an entirely new table.

Ideally, a keyword like `Table.read(filename, ..., mask=False)` would disable this behavior, for people who don't need this masking.
</issue>

## Gold patch (the original PR's code change — the solver does NOT see this)
<gold_patch>
diff --git a/astropy/io/fits/connect.py b/astropy/io/fits/connect.py
--- a/astropy/io/fits/connect.py
+++ b/astropy/io/fits/connect.py
@@ -112,7 +112,8 @@ def _decode_mixins(tbl):
 
 
 def read_table_fits(input, hdu=None, astropy_native=False, memmap=False,
-                    character_as_bytes=True, unit_parse_strict='warn'):
+                    character_as_bytes=True, unit_parse_strict='warn',
+                    mask_invalid=True):
     """
     Read a Table object from an FITS file
 
@@ -145,6 +146,8 @@ def read_table_fits(input, hdu=None, astropy_native=False, memmap=False,
         fit the table in memory, you may be better off leaving memory mapping
         off. However, if your table would not fit in memory, you should set this
         to `True`.
+        When set to `True` then ``mask_invalid`` is set to `False` since the
+        masking would cause loading the full data array.
     character_as_bytes : bool, optional
         If `True`, string columns are stored as Numpy byte arrays (dty
…[4560 more chars]
```

## Execution

- **session** `7a8a986f-a746-4a05-9770-8d413208becc` · tools: StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup

#### judge/main → **final verdict**
```json
{
  "axis": "underspecified",
  "claim": "The issue only suggests a hypothetical keyword name (`mask=False`) and does not say which reader (FITS vs ASCII vs all) should be changed, nor mention any interaction with memmap.",
  "quote": "Ideally, a keyword like `Table.read(filename, ..., mask=False)` would disable this behavior, for people who don't need this masking.",
  "ref": "issue",
  "source": "issue",
  "underspecified": 2,
  "underspecified_rationale": "The issue is a feature request phrased generically about `Table.read()`, but the accepted fix is narrowly scoped to `astropy/io/fits/connect.py:read_table_fits`. The issue never states the format(s) involved, never fixes the exact keyword name (it proposes `mask=False`, the gold patch implements `mask_invalid=True/False`), and says nothing about the additional behaviour of automatically disabling masking when `memmap=True`, which is a substantive extra requirement invented in the PR. An engineer would have to guess both the API name and the memmap coupling.",
  "false_negative": 3,
  "false_negative_rationale": "The hidden tests hardcode the gold patch's parameter name: `Table.read(filename, mask_invalid=False)` in both `test_mask_nans_on_read` and `test_mask_str_on_read`. A solver following the issue's own suggested API (`mask=False`) — or any other reasonable name like `masked=False` / `mask_nan=False` — would raise TypeError and fail, even with a fully correct implementation. Additionally `test_mask_nans_on_read` asserts `Table.read(filename, memmap=True).mask is None`, i.e. that memmap silently disables masking; this behaviour is nowhere hinted at in the issue, so even a solver that guesses the exact keyword name would likely still fail that assertion.",
  "evidence": [
    {
      "axis": "false_negative",
      "claim": "Tests require the exact keyword `mask_invalid`, while the issue proposes `mask`.",
      "quote": "tab = Table.read(filename, mask_invalid=False)\n        assert tab.mask is None",
      "ref": "astropy/io/fits/tests/test_connect.py",
      "source": "test_patch"
    },
    {
      "axis": "false_negative",
      "claim": "Tests assert an undisclosed behaviour that memmap=True disables masking.",
      "quote": "# using memmap also deactivate the masking\n        tab = Table.read(filename, memmap=True)\n        assert tab.mask is None",
      "ref": "astropy/io/fits/tests/test_connect.py",
      "source": "test_patch"
    },
    {
      "axis": "underspecified",
      "claim": "The gold patch scopes the change to the FITS connector only, which the issue does not specify.",
      "quote": "def read_table_fits(input, hdu=None, astropy_native=False, memmap=False,\n                    character_as_bytes=True, unit_parse_strict='warn',\n                    mask_invalid=True):",
      "ref": "astropy/io/fits/connect.py",
      "source": "gold_patch"
    }
  ],
  "decision": "flag",
  "confidence": 4
}
```

  - ⚠️ schema rejected: Output does not match required schema: root: must NOT have additional properties, root: must NOT have additional properties, root: must NOT have additional properties, root: must NOT have additional properties, root: must NOT have additional properties

#### judge/main → **final verdict**
```json
{
  "underspecified": 2,
  "underspecified_rationale": "The issue is a feature request phrased generically about `Table.read()`, but the accepted fix is narrowly scoped to `astropy/io/fits/connect.py:read_table_fits`. The issue never states which format(s) are involved, never fixes the exact keyword name (it proposes `mask=False`, the gold patch implements `mask_invalid=True/False`), and says nothing about the additional behaviour of automatically disabling masking when `memmap=True`, which is a substantive extra requirement introduced by the PR. An engineer must guess both the API name and the memmap coupling.",
  "false_negative": 3,
  "false_negative_rationale": "The hidden tests hardcode the gold patch's parameter name: `Table.read(filename, mask_invalid=False)` in both `test_mask_nans_on_read` and `test_mask_str_on_read`. A solver following the issue's own suggested API (`mask=False`) — or any other reasonable name like `masked=False`/`mask_nan=False` — would raise TypeError and fail despite a correct implementation. Additionally `test_mask_nans_on_read` asserts `Table.read(filename, memmap=True).mask is None`, i.e. that memmap silently disables masking; this is nowhere hinted at in the issue, so even a solver that guesses the exact keyword name would likely still fail that assertion.",
  "evidence": [
    {
      "axis": "false_negative",
      "claim": "Tests require the exact keyword `mask_invalid`, while the issue proposes `mask`.",
      "quote": "tab = Table.read(filename, mask_invalid=False)\n        assert tab.mask is None",
      "ref": "astropy/io/fits/tests/test_connect.py",
      "source": "test_patch"
    },
    {
      "axis": "false_negative",
      "claim": "Tests assert an undisclosed behaviour that memmap=True disables masking.",
      "quote": "# using memmap also deactivate the masking\n        tab = Table.read(filename, memmap=True)\n        assert tab.mask is None",
      "ref": "astropy/io/fits/tests/test_connect.py",
      "source": "test_patch"
    },
    {
      "axis": "underspecified",
      "claim": "The issue only suggests a hypothetical keyword name and gives no format scope or memmap requirement.",
      "quote": "Ideally, a keyword like `Table.read(filename, ..., mask=False)` would disable this behavior, for people who don't need this masking.",
      "ref": "issue",
      "source": "issue"
    },
    {
      "axis": "underspecified",
      "claim": "The gold patch scopes the change to the FITS connector only, which the issue does not specify.",
      "quote": "def read_table_fits(input, hdu=None, astropy_native=False, memmap=False,\n                    character_as_bytes=True, unit_parse_strict='warn',\n                    mask_invalid=True):",
      "ref": "astropy/io/fits/connect.py",
      "source": "gold_patch"
    }
  ],
  "decision": "flag",
  "confidence": 4
}
```


## Result
- subtype: success · turns: 3 · 32s · cost $0.153 · tokens in/out/cache: 4/3009/5249

### ✅ Verification passed