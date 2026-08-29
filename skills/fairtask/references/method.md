# The fairtask method (manual mode)

The authoritative text lives in the engine (`src/lib/rubric.ts`, `src/variants/v2-specialists.ts`); this is the
same method condensed for an agent doing it by hand with the repository checked out at the base commit.

## Rubric

A task = issue text + the repository before the fix + hidden tests from the fixing PR. The solver sees only the issue
and the repository, cannot ask questions, and is graded by the FAIL_TO_PASS tests.

**underspecified** — is the issue well-specified enough for a meaningful attempt?
0 clear what is required · 1 some blanks, but a sensible interpretation exists · 2 vague, unclear what a successful
solution looks like · 3 almost impossible to understand without more information.

**false_negative** — would ALL reasonable solutions pass the tests?
0 tests cover all solutions · 1 only unusual solutions may be missed · 2 some perfectly reasonable solutions would
fail · 3 tests are too narrow/broad or test something other than the issue.

Decision: **usable** if both ≤ 1, else **flag**.

## Spec probe (underspecified)

1. Grep/Read the code the issue points at. List what a solver must decide: expected behaviour, scope (one case or the
   general case), edge cases, interface (names, types, errors), and which of several plausible readings is wanted.
2. For each open decision, check whether the codebase resolves it for a careful reader (conventions, docstrings,
   sibling functions, the issue's own reproduction). Only decisions the code does not resolve count.
3. Compare with the gold patch: a choice it made that the issue never implied, where a different choice would have
   been equally faithful, is ambiguity. Implementation details the issue reasonably left to the engineer are not.
4. Score. Most real issues are 0–1; 2 is genuine ambiguity about WHAT to build; 3 is an issue that cannot be understood.

## Test probe (false_negative)

1. Read the test patch against the real test files: where each hunk lands, which fixtures and helpers it uses.
2. For every new or changed assertion, write down what it pins: names of functions/parameters/attributes, argument
   order, return values and types, exception classes, exact message wording, output format, warning categories.
   For each: stated (or unambiguously implied) by the issue, or introduced only by the gold patch? Check the repository
   for conventions that would make the gold patch's choice the only natural one — a convention-following name is not
   a discrepancy.
3. Write at least two concrete alternative fixes a competent engineer could produce from the issue alone (a different
   parameter name, a different error type, a fix at a different layer, handling only the reported case). Trace whether
   each passes the FAIL_TO_PASS tests.
4. Check the other direction: do the tests test what the issue is about, or something adjacent?
5. Score. One test-pinned name or message the issue never mentions is typically a 2; tests that require a different
   feature than the issue describes are a 3. Tests not in FAIL_TO_PASS do not count.

## Cheap pre-check (code, no judgement)

Identifiers used inside FAIL_TO_PASS test bodies that the gold patch introduces and that appear neither in the issue
text nor anywhere in the repository at the base commit can only be guessed by a solver. On the evaluation set this
rule has 94% specificity and 17% sensitivity: when it fires it is almost always right; when it is silent it proves
nothing.

## Evidence and verdict

Every score ≥ 2 needs at least one evidence item: `{axis, source: issue | gold_patch | test_patch | repo, ref, quote}`
where `ref` is `path:Lstart-Lend` for the repository or the file name for a patch, and `quote` is verbatim (elide
with `...` only between verbatim fragments). Verdict fields: `underspecified`, `underspecified_rationale`,
`false_negative`, `false_negative_rationale`, `evidence[]`, `decision`, `confidence` (1–5).
