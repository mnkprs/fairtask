# Trajectory — django__django-13128 — v3-verify (v3-verify)
Model: `claude-opus-5` · stratum: **clean** · human labels: underspecified=1, false_negative=1, filter_out=false

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
# Candidate task: django__django-13128
Repository: django/django @ 2d67222472f80f251607ae1b720527afceba06ad (version 3.2)

## Issue text (this is ALL the solver will see)
<issue>
make temporal subtraction work without ExpressionWrapper
Description
	
class Experiment(models.Model):
	start = models.DateTimeField()
	end = models.DateTimeField()
Experiment.objects.annotate(
	delta=F('end') - F('start') + Value(datetime.timedelta(), output_field=DurationField())
)
This gives:
django.core.exceptions.FieldError: Expression contains mixed types: DateTimeField, DurationField. You must set output_field.
</issue>

## Gold patch (the original PR's code change — the solver does NOT see this)
<gold_patch>
diff --git a/django/db/models/expressions.py b/django/db/models/expressions.py
--- a/django/db/models/expressions.py
+++ b/django/db/models/expressions.py
@@ -443,23 +443,6 @@ def set_source_expressions(self, exprs):
         self.lhs, self.rhs = exprs
 
     def as_sql(self, compiler, connection):
-        try:
-            lhs_type = self.lhs.output_field.get_internal_type()
-        except FieldError:
-            lhs_type = None
-        try:
-            rhs_type = self.rhs.output_field.get_internal_type()
-        except FieldError:
-            rhs_type = None
-        if (
-            not connection.features.has_native_duration_field and
-            'DurationField' in {lhs_type, rhs_type} and
-            lhs_type != rhs_type
-        ):
-            return DurationExpression(self.lhs, self.connector, self.rhs).as_sql(compiler, connection)
-        datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}
-        if self.connector == self.SUB and lhs_type in datetime_fields and lhs_type == rhs_type:
-            return TemporalSubtraction(self.lhs, self.rhs).as_sql(compiler, connection)
         expressions = []
         expression_params = []
         sql, params = compiler.compile(self.lhs)
@@ -474,10 +457,30 @@ def as_sql(self, compiler, connection):
         return expression_wrapper % sql, expression_params
 
     def resolve_expression(self, query=None, allow_joins=True, reuse=None, summarize=False, for_save=False):
+        lhs = self.lhs.resolve_expression(query, allow_joins, reuse, summarize, for_save)
+        rhs = self.rhs.resolve_expression(query, allow_joins, reuse, summarize, for_save)
+        if not isinstance(self, (DurationExpression, TemporalSubtraction)):
+            try:
+                lhs_type = lhs.output_field.get_internal_type()
+            except (AttributeError, FieldError):
+                lhs_type = None
+            try:
+                rhs_type = rhs.output_field.get_internal_type()
+            except (AttributeError, FieldError):
+                rhs_type = None
+            if 'DurationField' in {lhs_type, rhs_type} and lhs_type != rhs_type:
+                return DurationExpression(self.lhs, self.connector, self.rhs).resolve_expression(
+                    query, allow_joins, reuse, summarize, for_sav
…[7454 more chars]
```

## Execution

- **session** `3a75b307-2775-45c3-8580-1f7cdf35f75f` · tools: Task, Glob, Grep, Read, StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup, spec-probe, test-probe

**judge/main:** I'll dispatch both probes in parallel.

#### judge/main → dispatch `spec-probe` (Spec probe django-13128)
```text
Assess the underspecified axis for this candidate SWE benchmark task.

Repository: django/django @ commit 2d67222472f80f251607ae1b720527afceba06ad (version 3.2)

## Issue text (this is ALL the solver will see)
make temporal subtraction work without ExpressionWrapper
Description

class Experiment(models.Model):
	start = models.DateTimeField()
	end = models.DateTimeField()
Experiment.objects.annotate(
	delta=F('end') - F('start') + Value(datetime.timedelta(), output_field=DurationField())
)
This gives:
django.core.exceptions.FieldError: Expression contains mixed types: DateTimeField, DurationField. You must set output_field.

## Gold patch (solver does NOT see this)
diff --git a/django/db/models/expressions.py b/django/db/models/expressions.py
--- a/django/db/models/expressions.py
+++ b/djan
…[3850 more chars]
```


- subagent:spec-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":280,"limit":260}
```
  - ↩ result:
```text
280	        """
281	        try:
282	            return self.output_field
283	        except FieldError:
284	            if not self._output_field_resolved_to_none:
285	                raise
286	
287	    def _resolve_output_field(self):
288	        """
289	        Attempt to infer the output type of the expression. If the output
290	        fields of all source fields match then, simply infer the same type
291	        here. This isn't always correct, but it makes sense most of the time.
292	
293	        Consider the difference between `2 + 2` and `2 / 3`. Inferring
294	        the type here is a convenience for the common case. The user should
295	        supply their own output_field with m
…[5324 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"def test_date_subtraction|def test_time_subtraction|def test_date_case_subtraction|def test_datetime_subtraction_microseconds|def test_date_subquery_subtraction","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-A":30}
```
  - ↩ result:
```text
1494:    def test_date_subtraction(self):
1495-        queryset = Experiment.objects.annotate(
1496-            completion_duration=ExpressionWrapper(
1497-                F('completed') - F('assigned'), output_field=DurationField()
1498-            )
1499-        )
1500-
1501-        at_least_5_days = {e.name for e in queryset.filter(completion_duration__gte=datetime.timedelta(days=5))}
1502-        self.assertEqual(at_least_5_days, {'e3', 'e4', 'e5'})
1503-
1504-        at_least_120_days = {e.name for e in queryset.filter(completion_duration__gte=datetime.timedelta(days=120))}
1505-        self.assertEqual(at_least_120_days, {'e5'})
1506-
1507-        less_than_5_days = {e.name for e in qu
…[5041 more chars]
```


#### judge/main → dispatch `test-probe` (Test probe django-13128)
```text
Assess the false_negative axis for this candidate SWE benchmark task.

Repository: django/django @ commit 2d67222472f80f251607ae1b720527afceba06ad (version 3.2)

## Issue text (ALL the solver sees)
make temporal subtraction work without ExpressionWrapper
Description

class Experiment(models.Model):
	start = models.DateTimeField()
	end = models.DateTimeField()
Experiment.objects.annotate(
	delta=F('end') - F('start') + Value(datetime.timedelta(), output_field=DurationField())
)
This gives:
django.core.exceptions.FieldError: Expression contains mixed types: DateTimeField, DurationField. You must set output_field.

## Gold patch
diff --git a/django/db/models/expressions.py b/django/db/models/expressions.py
--- a/django/db/models/expressions.py
+++ b/django/db/models/expressions.py
@@ -443,23 
…[4762 more chars]
```


- subagent:test-probe → `Read` ```json
{"__unparsedToolInput":{"raw":"{\"file_path\": \"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py\", \"offset\": 400, , \"limit\": 180}","len":155}}
```
  - ❌ error:
```text
<tool_use_error>InputValidationError: Read was called with input that could not be parsed as JSON.
You sent (first 155 of 155 bytes): {"file_path": "/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py", "offset": 400, , "limit": 180}
Common causes: unescaped backslashes in file paths (use / or \\), unescaped control characters, or truncated output. Retry with valid JSON.</tool_use_error>
```


- subagent:test-probe → `Grep` ```json
{"pattern":"test_date_subtraction|test_date_subquery_subtraction|test_date_case_subtraction|test_time_subtraction|test_time_subquery_subtraction|test_datetime_subtraction|test_datetime_subquery_subtraction|test_datetime_subtraction_microseconds|test_duration_with_datetime","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
1494:    def test_date_subtraction(self):
1523:    def test_date_subquery_subtraction(self):
1533:    def test_date_case_subtraction(self):
1550:    def test_time_subtraction(self):
1576:    def test_time_subquery_subtraction(self):
1587:    def test_datetime_subtraction(self):
1611:    def test_datetime_subquery_subtraction(self):
1621:    def test_datetime_subtraction_microseconds(self):
1630:    def test_duration_with_datetime(self):
1639:    def test_duration_with_datetime_microseconds(self):
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":400,"limit":180}
```
  - ↩ result:
```text
400	        for arg, value in arguments:
401	            if isinstance(value, fields.Field):
402	                if value.name and value.model:
403	                    value = (value.model._meta.label, value.name)
404	                else:
405	                    value = type(value)
406	            else:
407	                value = make_hashable(value)
408	            identity.append((arg, value))
409	        return tuple(identity)
410	
411	    def __eq__(self, other):
412	        if not isinstance(other, BaseExpression):
413	            return NotImplemented
414	        return other.identity == self.identity
415	
416	    def __hash__(self):
417	        return hash(self.identity)
418	
419	
4
…[5324 more chars]
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","offset":1470,"limit":190}
```
  - ↩ result:
```text
1470	        self.assertEqual(zeros, ['e0'])
1471	
1472	        end_less = [e.name for e in Experiment.objects.filter(end__lt=F('start') + F('estimated_time'))]
1473	        self.assertEqual(end_less, ['e2'])
1474	
1475	        delta_math = [
1476	            e.name for e in
1477	            Experiment.objects.filter(end__gte=F('start') + F('estimated_time') + datetime.timedelta(hours=1))
1478	        ]
1479	        self.assertEqual(delta_math, ['e4'])
1480	
1481	        queryset = Experiment.objects.annotate(shifted=ExpressionWrapper(
1482	            F('start') + Value(None, output_field=DurationField()),
1483	            output_field=DateTimeField(),
1484	        ))
1485	        self.asse
…[5324 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"ExpressionWrapper","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/docs","output_mode":"content","-C":4,"head_limit":60}
```
  - ↩ result:
```text
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/docs/ref/models/expressions.txt-214-
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/docs/ref/models/expressions.txt-215-If the fields that you're combining are of different types you'll need
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/docs/ref/models/expressions.txt-216-to tell Django what kind of field will be returned. Since ``F()`` does not
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/docs/ref/models/expressions.txt-217-directly support ``output_field`` you will need to wrap the expression with
docs/ref/models/expressions.t
…[3203 more chars]
```

  - ↩ result (subagent report):
```text
## Report

- **Score:** 0 — The issue gives an exact reproduction, the exact exception, and a title that states the desired end state ("make temporal subtraction work without `ExpressionWrapper`"); the repo makes the mechanism and the intended output type unambiguous.

- **Evidence:**
  - The failing behaviour is fully pinned by the issue: a concrete model, a concrete queryset, and the exact error text, so the acceptance criterion is "this annotation works without setting `output_field`" — issue: `Experiment.objects.annotate(\n\tdelta=F('end') - F('start') + Value(datetime.timedelta(), output_field=DurationField())\n)` ... `django.core.exceptions.FieldError: Expression contains mixed types: DateTimeField, DurationField. You must set output_field.`
  - The error message quoted in the issue is emitted verbatim by `_resolve_output_field`, pointing a solver straight at output-field inference as the thing to fix — `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py:L301-L312`: `if not isinstance(output_field, source.__class__):` ... `'Expression contains mixed types: %s, %s. You must '\n                        'set output_field.' % (`
  - The codebase already resolves the "what should the type be?" decision: temporal subtraction is dispatched to `TemporalSubtraction`, whose `output_field` is `DurationField`; the only problem is that the dispatch happens at SQL-compile time (`as_sql`), i.e. too late to influence `output_field` — `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py:L445-L462`: `    def as_sql(self, compiler, connection):` ... `        if self.connector == self.SUB and lhs_type in datetime_fields and lhs_type == rhs_type:\n            return TemporalSubtraction(self.lhs, self.rhs).as_sql(compiler, connection)` and `L512-L516`: `class TemporalSubtraction(CombinedExpression):\n    output_field = fields.DurationField()`
  - `resolve_expression` on `CombinedExpression` is the obvious (and only other) hook, and it currently does nothing type-aware — exactly the gap the gold patch fills — `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py:L476-L481`: `        c = self.copy()\n        c.is_summary = summarize\n        c.lhs = c.lhs.resolve_expression(query, allow_joins, reuse, summarize, for_save)`
  - Scope (all temporal types, not just `DateTimeField`) is settled by the pre-existing dispatch set and mirrored by the FAIL_TO_PASS list covering date/time/datetime/subquery/case cases — `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py:L460`: `        datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}`
  - The test patch is a mechanical de-wrapping of existing tests, i.e. it asserts exactly what the issue title asks for, with no extra API surface invented — existing form at `/Users/manoskaparos/Projects/taskpro
…[1539 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"supports_temporal_subtraction|has_native_duration_field","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/backends","output_mode":"content","-n":true}
```
  - ↩ result:
```text
django/db/backends/base/features.py:69:    has_native_duration_field = False
django/db/backends/base/features.py:73:    supports_temporal_subtraction = False
django/db/backends/base/operations.py:633:        if self.connection.features.supports_temporal_subtraction:
django/db/backends/sqlite3/features.py:28:    supports_temporal_subtraction = True
django/db/backends/postgresql/features.py:14:    has_native_duration_field = True
django/db/backends/postgresql/features.py:34:    supports_temporal_subtraction = True
django/db/backends/oracle/features.py:17:    has_native_duration_field = True
django/db/backends/oracle/features.py:33:    supports_temporal_subtraction = True
django/db/backends/mys
…[58 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"_resolve_output_field|mixed types","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","output_mode":"content","-n":true,"-C":12}
```
  - ↩ result:
```text
257-
258-    @property
259-    def conditional(self):
260-        return isinstance(self.output_field, fields.BooleanField)
261-
262-    @property
263-    def field(self):
264-        return self.output_field
265-
266-    @cached_property
267-    def output_field(self):
268-        """Return the output type of this expressions."""
269:        output_field = self._resolve_output_field()
270-        if output_field is None:
271-            self._output_field_resolved_to_none = True
272-            raise FieldError('Cannot resolve expression type, unknown output_field')
273-        return output_field
274-
275-    @cached_property
276-    def _output_field_or_none(self):
277-        """
278-   
…[3928 more chars]
```

  - ↩ result (subagent report):
```text
## Report

**Score:** 1 — The FAIL_TO_PASS tests are the pre‑existing temporal-subtraction tests with `ExpressionWrapper(...)` stripped, so they pin only the observable behaviour the issue title asks for (bare `F(temporal) - F(temporal)` must yield a `DurationField` result); the main alternative implementation (fixing `_resolve_output_field` instead of `resolve_expression`) passes, but a solver who fixes only the `DateTimeField` case shown in the issue body fails 5 of the 7 tests.

**Evidence**

- The tests only change *how the expression is written*, not any new API surface: no new names, exceptions, messages, or signatures are introduced. `test_patch`: "replaces `ExpressionWrapper(F('completed') - F('assigned'), output_field=DurationField())` with plain `F('completed') - F('assigned')` in test_date_subtraction, ... e.g.: `+            completion_duration=F('completed') - F('assigned'),`". Nothing in the assertions references `TemporalSubtraction`, `DurationExpression`, or resolve-vs-compile timing, so the gold patch's structural choice (moving dispatch from `as_sql` to `resolve_expression`) is not pinned.
- The pre-fix SQL-generation dispatch already exists, so an alternative fix that only teaches `CombinedExpression` how to *resolve its output field* produces identical SQL and identical converters, and would pass all seven tests. `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py:L454-L462`:
  '''
        if (
            not connection.features.has_native_duration_field and
            'DurationField' in {lhs_type, rhs_type} and
            lhs_type != rhs_type
        ):
            return DurationExpression(self.lhs, self.connector, self.rhs).as_sql(compiler, connection)
        datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}
        if self.connector == self.SUB and lhs_type in datetime_fields and lhs_type == rhs_type:
            return TemporalSubtraction(self.lhs, self.rhs).as_sql(compiler, connection)
  '''
- The natural alternative hook is right there and is the code that actually raises the issue's error, so overriding it is an obvious competing fix; it uses `get_source_fields()`, which works equally for the `Subquery` and `Case` left-hand sides the tests exercise. `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py:L301-L311`: `sources_iter = (source for source in self.get_source_fields() if source is not None) ... 'Expression contains mixed types: %s, %s. You must ' 'set output_field.' % (`
- The tests go wider than the issue body (Date, Time, Subquery, `Case`), but the issue *title* asks for temporal subtraction generally and the repo already enumerates the three temporal types, making the general fix the conventional one. `issue`: "make temporal subtraction work without ExpressionWrapper"; `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py:L460`:
…[3023 more chars]
```


**judge/main:** Let me spot-check the key claims myself.

- judge/main → `Grep` ```json
{"pattern":"datetime_fields = \\{'DateField', 'DateTimeField', 'TimeField'\\}","output_mode":"content","-n":true,"-C":8}
```
  - ↩ result:
```text
django/db/models/expressions.py-452-        except FieldError:
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py-453-            rhs_type = None
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py-454-        if (
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py-455-            not connection.features.has_native_duration_field and
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py-456-            'DurationField' in {lhs_type, rhs_type} and
/Users/manoskaparos/Projec
…[1717 more chars]
```


- judge/main → `Grep` ```json
{"pattern":"Expression contains mixed types","output_mode":"content","-n":true,"-C":10}
```
  - ↩ result:
```text
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py-296-
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py-297-        If a source's output field resolves to None, exclude it from this check.
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py-298-        If all sources are None, then an error is raised higher up the stack in
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py-299-        the output_field property.
/Users/manoskaparos/Projects/taskprobe/workspaces/djang
…[4881 more chars]
```


**judge/main:** Both probes' strongest claims verified in my own read: the pre-existing `as_sql` dispatch at `expressions.py:L454-462` already enumerates `{'DateField', 'DateTimeField', 'TimeField'}` and dispatches to `TemporalSubtraction`/`DurationExpression`, and the error message the issue quotes comes from `_resolve_output_field` at L301-312.

#### judge/main → **final verdict**
```json
{
  "underspecified": 1,
  "underspecified_rationale": "The issue is terse but the goal is stated in the title (\"make temporal subtraction work without ExpressionWrapper\") and pinned by a concrete repro plus the exact FieldError. The quoted message is emitted verbatim by BaseExpression._resolve_output_field (django/db/models/expressions.py:L301-L312), pointing directly at output-field inference. The codebase already contains the full dispatch logic in CombinedExpression.as_sql (L445-L462) routing to TemporalSubtraction (output_field = DurationField) and DurationExpression; the only gap is that this dispatch happens at compile time, too late to influence output_field resolution. So the required change (move/duplicate the dispatch to resolve_expression or teach output-field resolution about temporal subtraction) is readily inferable. Minor blanks: the issue only shows DateTimeField and never states that DateField/TimeField/Subquery/Case operands must also work, and never mentions the has_native_duration_field relocation in DurationExpression.as_sql — but the pre-existing datetime_fields set makes generalising the obvious reading.",
  "false_negative": 1,
  "false_negative_rationale": "The test patch is purely a mechanical de-wrapping of pre-existing FTimeDeltaTests: ExpressionWrapper(F('completed') - F('assigned'), output_field=DurationField()) becomes F('completed') - F('assigned'), with the same assertions (assertEqual on name sets, assertIsNone, assertTrue(queryset.exists()), timedelta equality). No new API name, class, exception, error message or SQL-shape assertion introduced by the gold patch is referenced — nothing asserts that dispatch happens in resolve_expression rather than as_sql, so an alternative fix that only makes _resolve_output_field/output_field aware of temporal subtraction (producing identical SQL via the untouched as_sql dispatch) would also pass. The one residual risk is breadth: a solver who only fixes the literal DateTimeField case from the issue body would fail test_date_subtraction, test_date_subquery_subtraction, test_date_case_subtraction, test_time_subtraction and test_time_subquery_subtraction, since those use DateField/TimeField operands. That is an unusual narrow reading given the issue title says \"temporal\" and the repo already enumerates all three types, so it stays at 1.",
  "evidence": [
    {
      "axis": "underspecified",
      "claim": "The repo already contains the temporal-subtraction dispatch, but only at SQL-compile time, making the required fix (move it earlier) inferable from the issue's error message alone.",
      "source": "repo",
      "ref": "django/db/models/expressions.py:L454-L462",
      "quote": "            return DurationExpression(self.lhs, self.connector, self.rhs).as_sql(compiler, connection)\n        datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}\n        if self.connector == self.SUB and lhs_type in datetime_fields and lhs_type == rhs_type:\n            return TemporalSubtraction(self.lhs, self.rhs).as_sql(compiler, connection)"
    },
    {
      "axis": "underspecified",
      "claim": "The exact error string quoted in the issue is raised by _resolve_output_field, localising the problem for the solver.",
      "source": "repo",
      "ref": "django/db/models/expressions.py:L305-L311",
      "quote": "                    raise FieldError(\n                        'Expression contains mixed types: %s, %s. You must '\n                        'set output_field.' % ("
    },
    {
      "axis": "false_negative",
      "claim": "The hidden tests only remove the ExpressionWrapper and keep the original assertions, introducing no gold-patch-specific API surface.",
      "source": "test_patch",
      "ref": "tests/expressions/tests.py",
      "quote": "-            completion_duration=ExpressionWrapper(\n-                F('completed') - F('assigned'), output_field=DurationField()\n-            )\n+            completion_duration=F('completed') - F('assigned'),"
    }
  ],
  "decision": "usable",
  "confidence": 4
}
```


## Result
- subtype: success · turns: 6 · 204s · cost $0.935 · tokens in/out/cache: 6/6465/40480

### ✅ Verification passed