# Trajectory — django__django-13128 — v5-cheap-probes (v5-rerun)
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

## Calibration: how human annotators scored underspecified on other django/django issues
These are different issues from the same repository (scores are the max over three annotators). Use them to
calibrate what a 0/1 versus a 2/3 looks like on this codebase — not as facts abo
…[2005 more chars]
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
…[2491 more chars]
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

- **session** `4710c662-1d28-4413-a326-08e2f068008d` · tools: Task, Glob, Grep, Read, StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup, spec-probe, test-probe

**judge/main:** I'll dispatch both probes in parallel.

#### judge/main → dispatch `spec-probe` (Assess issue specificity)
```text
Assess the "underspecified" axis for this benchmark candidate.

Repository: django/django @ commit 2d67222472f80f251607ae1b720527afceba06ad (version 3.2). Assume the repo is checked out in the current working directory.

ISSUE TEXT (all the solver sees):
---
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
---

GOLD PATCH (solver does NOT see):
diff --git a/django/db/models/expressions.py b/django/db/models/expressions.py

…[2477 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"class CombinedExpression|class DurationExpression|class TemporalSubtraction|_resolve_output_field|def resolve_expression|def as_sql","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
21:    def as_sqlite(self, compiler, connection, **extra_context):
194:    def as_sql(self, compiler, connection):
234:    def resolve_expression(self, query=None, allow_joins=True, reuse=None, summarize=False, for_save=False):
269:        output_field = self._resolve_output_field()
279:        _resolve_output_field() didn't return an output type.
287:    def _resolve_output_field(self):
425:class CombinedExpression(SQLiteNumericMixin, Expression):
445:    def as_sql(self, compiler, connection):
476:    def resolve_expression(self, query=None, allow_joins=True, reuse=None, summarize=False, for_save=False):
484:class DurationExpression(CombinedExpression):
496:    def as_sql(self, compiler, c
…[2086 more chars]
```


- subagent:spec-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprakos/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":260,"limit":300}
```
  - ❌ error:
```text
File does not exist. Note: your current working directory is /Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo.
```


- subagent:spec-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":260,"limit":300}
```
  - ↩ result:
```text
260	        return isinstance(self.output_field, fields.BooleanField)
261	
262	    @property
263	    def field(self):
264	        return self.output_field
265	
266	    @cached_property
267	    def output_field(self):
268	        """Return the output type of this expressions."""
269	        output_field = self._resolve_output_field()
270	        if output_field is None:
271	            self._output_field_resolved_to_none = True
272	            raise FieldError('Cannot resolve expression type, unknown output_field')
273	        return output_field
274	
275	    @cached_property
276	    def _output_field_or_none(self):
277	        """
278	        Return the output field of this expression, or No
…[5324 more chars]
```


#### judge/main → dispatch `test-probe` (Assess test scoping)
```text
Assess the "false_negative" axis for this benchmark candidate.

Repository: django/django @ commit 2d67222472f80f251607ae1b720527afceba06ad (version 3.2), checked out in cwd.

ISSUE TEXT (all the solver sees):
---
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
---

GOLD PATCH (django/db/models/expressions.py): removes the type-dispatch logic from CombinedExpression.as_sql and moves it into CombinedExpression.resolve_expr
…[2266 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"class CombinedExpression|class DurationExpression|class TemporalSubtraction","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
425:class CombinedExpression(SQLiteNumericMixin, Expression):
484:class DurationExpression(CombinedExpression):
512:class TemporalSubtraction(CombinedExpression):
```


- subagent:test-probe → `Grep` ```json
{"pattern":"class FTimeDeltaTests","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
1290:class FTimeDeltaTests(TestCase):
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprakos/repo"}
```
  - ❌ error:
```text
File does not exist. Note: your current working directory is /Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo.
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":400,"limit":150}
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
…[5267 more chars]
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","offset":1290,"limit":200}
```
  - ↩ result:
```text
1290	class FTimeDeltaTests(TestCase):
1291	
1292	    @classmethod
1293	    def setUpTestData(cls):
1294	        cls.sday = sday = datetime.date(2010, 6, 25)
1295	        cls.stime = stime = datetime.datetime(2010, 6, 25, 12, 15, 30, 747000)
1296	        midnight = datetime.time(0)
1297	
1298	        delta0 = datetime.timedelta(0)
1299	        delta1 = datetime.timedelta(microseconds=253000)
1300	        delta2 = datetime.timedelta(seconds=44)
1301	        delta3 = datetime.timedelta(hours=21, minutes=8)
1302	        delta4 = datetime.timedelta(days=10)
1303	        delta5 = datetime.timedelta(days=90)
1304	
1305	        # Test data is set so that deltas and delays will be
1306	        # stri
…[5324 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"def test_date_subtraction|def test_date_subquery_subtraction|def test_date_case_subtraction|def test_time_subtraction|def test_time_subquery_subtraction|def test_datetime_subtraction|def test_datetime_subquery_subtraction|def test_datetime_subtraction_microseconds|def test_duration_with_datetime|def test_duration_with_datetime_microseconds","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true}
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
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","offset":1494,"limit":160}
```
  - ↩ result:
```text
1494	    def test_date_subtraction(self):
1495	        queryset = Experiment.objects.annotate(
1496	            completion_duration=ExpressionWrapper(
1497	                F('completed') - F('assigned'), output_field=DurationField()
1498	            )
1499	        )
1500	
1501	        at_least_5_days = {e.name for e in queryset.filter(completion_duration__gte=datetime.timedelta(days=5))}
1502	        self.assertEqual(at_least_5_days, {'e3', 'e4', 'e5'})
1503	
1504	        at_least_120_days = {e.name for e in queryset.filter(completion_duration__gte=datetime.timedelta(days=120))}
1505	        self.assertEqual(at_least_120_days, {'e5'})
1506	
1507	        less_than_5_days = {e.name for e in qu
…[5324 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"test_date_case_subtraction|test_date_subquery_subtraction|test_datetime_subquery_subtraction|test_datetime_subtraction_microseconds|test_time_subquery_subtraction|test_date_subtraction|test_time_subtraction\\b","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true,"-A":15}
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
…[4253 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"_resolve_output_field|def output_field","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
267:    def output_field(self):
269:        output_field = self._resolve_output_field()
279:        _resolve_output_field() didn't return an output type.
287:    def _resolve_output_field(self):
1051:    def _resolve_output_field(self):
1233:    def _resolve_output_field(self):
```

  - ↩ result (subagent report):
```text
# Assessment: django__django-13128

**Score:** 1 — The bug is clearly reproducible and the title states the exact goal, but the reader must infer that the fix should be a general architectural change (not just patching the one example) to satisfy the intended scope.

**Evidence:**

- The issue title is an explicit, unambiguous statement of the desired outcome.
  location: `issue`
  quote: `make temporal subtraction work without ExpressionWrapper`

- The reproduction is concrete and the exact error is given, so the engineer knows precisely which code path breaks and can trace it.
  location: `issue`
  quote: `django.core.exceptions.FieldError: Expression contains mixed types: DateTimeField, DurationField. You must set output_field.`

- The codebase already contains the type-dispatch logic needed (DateField/TimeField/DateTimeField → DurationField, and DurationField mixed-type handling), but it lives only in `as_sql`, so `_resolve_output_field`/`output_field` (called earlier, e.g. when combining with another expression) doesn't know about it — this is the actual root cause a solver must locate.
  location: `django/db/models/expressions.py:L445-L462`
  quote: `datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}\n        if self.connector == self.SUB and lhs_type in datetime_fields and lhs_type == rhs_type:\n            return TemporalSubtraction(self.lhs, self.rhs).as_sql(compiler, connection)`

- The generic mixed-type check that actually raises the error at annotate-time is in the base `Expression` class, unaware of the CombinedExpression-specific dispatch — a solver has to connect these two mechanisms themselves.
  location: `django/db/models/expressions.py:L301-L311`
  quote: `for source in sources_iter:\n                if not isinstance(output_field, source.__class__):\n                    raise FieldError(\n                        'Expression contains mixed types: %s, %s. You must '`

- The FAIL_TO_PASS tests (test_date_case_subtraction, test_date_subquery_subtraction, test_datetime_subquery_subtraction, test_time_subquery_subtraction, etc.) exercise temporal subtraction in contexts (subqueries, Case/When) never mentioned in the issue — the issue only shows a plain `F('end') - F('start')` example, so the reader must generalize the intended scope from the title rather than the reproduction.
  location: `tests/expressions/tests.py:L1523-L1530`
  quote: `def test_date_subquery_subtraction(self):\n        subquery = Experiment.objects.filter(pk=OuterRef('pk')).values('completed')\n        queryset = Experiment.objects.annotate(\n            difference=ExpressionWrapper(\n                subquery - F('completed'), output_field=DurationField(),`

- These pre-existing tests already demonstrate that `ExpressionWrapper` was previously required in exactly these temporal-subtraction scenarios, which gives a careful reader (with codebase access) concrete evidence of the full range of cases the fix should cover, resolving most of the scope ambigu
…[846 more chars]
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":255,"limit":60}
```
  - ↩ result:
```text
255	        ])
256	        return c
257	
258	    @property
259	    def conditional(self):
260	        return isinstance(self.output_field, fields.BooleanField)
261	
262	    @property
263	    def field(self):
264	        return self.output_field
265	
266	    @cached_property
267	    def output_field(self):
268	        """Return the output type of this expressions."""
269	        output_field = self._resolve_output_field()
270	        if output_field is None:
271	            self._output_field_resolved_to_none = True
272	            raise FieldError('Cannot resolve expression type, unknown output_field')
273	        return output_field
274	
275	    @cached_property
276	    def _output_field_or
…[1792 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"TemporalSubtraction|DurationExpression|CombinedExpression","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
1772:        self.assertEqual(repr(F('cost') + F('tax')), "<CombinedExpression: F(cost) + F(tax)>")
```


- subagent:test-probe → `Grep` ```json
{"pattern":"supports_temporal_subtraction","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo","output_mode":"files_with_matches"}
```
  - ↩ result:
```text
Found 9 files
tests/expressions/tests.py
tests/backends/base/test_operations.py
docs/releases/1.10.txt
django/db/backends/sqlite3/features.py
django/db/backends/postgresql/features.py
django/db/backends/oracle/features.py
django/db/backends/mysql/features.py
django/db/backends/base/operations.py
django/db/backends/base/features.py
```

  - ↩ result (subagent report):
```text
Pre-existing feature flag, confirming these skip decorators aren't new. This is consistent behavior-only testing.

Based on this analysis, I'm confident in the assessment.

## Score: 1

**Summary:** The tests verify end-to-end query-result behavior (annotate/filter results, `assertIsNone`, `assertTrue(queryset.exists())`) for bare temporal subtraction (`F()-F()`, subquery, `Case`) across `DateField`/`DateTimeField`/`TimeField`, directly matching the issue's title "make temporal subtraction work without ExpressionWrapper." They don't pin implementation details (no assertions on class names like `TemporalSubtraction`/`DurationExpression`, no exact error messages). A structurally different but behaviorally equivalent fix (e.g., overriding `_resolve_output_field` on `CombinedExpression` to detect matching temporal types under `SUB` and return `DurationField()`, leaving the existing `as_sql` dispatch logic untouched) would satisfy all FAIL_TO_PASS tests. Docked one point because the tests exercise a materially broader surface (subqueries, `Case`, three temporal field types) than the issue's single narrow reproduction example, so a minimal fix addressing only the literal example (`DateTimeField` subtraction combined with a `Value(timedelta())` addend) without generalizing to `DateField`/`TimeField`/subquery cases would fail several of these tests — though the existing pre-fix `as_sql` dispatch code (`datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}`) makes such generalization the natural/expected choice for a competent engineer reading the surrounding code.

**Evidence:**
- Issue is phrased as a general capability request, not limited to one field type — `issue`: "make temporal subtraction work without ExpressionWrapper" — repro uses `F('end') - F('start')` on `DateTimeField`s.
- Existing pre-fix `as_sql` dispatch already generalizes across three temporal types, showing this is the established convention a fix should follow — `django/db/models/expressions.py:L460-L462`: `datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}\n        if self.connector == self.SUB and lhs_type in datetime_fields and lhs_type == rhs_type:\n            return TemporalSubtraction(self.lhs, self.rhs).as_sql(compiler, connection)`
- Root cause confirmed: generic output_field inference silently returns the wrong (non-Duration) type for temporal subtraction — `django/db/models/expressions.py:L301-L312`: `sources_iter = (source for source in self.get_source_fields() if source is not None)\n        for output_field in sources_iter:\n            for source in sources_iter:\n                if not isinstance(output_field, source.__class__):\n                    raise FieldError(...)\n            return output_field`
- FAIL_TO_PASS tests assert only end results, not implementation, e.g. `tests/expressions/tests.py:L1523-L1530` (`test_date_subquery_subtraction`): `subquery = Experiment.objects.filter(pk=OuterRef('pk')).values('completed')\n        queryset = Expe
…[1343 more chars]
```


- judge/main → `Read` ```json
{"file_path":"/tmp/x"}
```
  - ❌ error:
```text
File does not exist. Note: your current working directory is /Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo.
```


- judge/main → `Grep` ```json
{"pattern":"datetime_fields = |sources_iter|def test_date_subquery_subtraction|completion_duration=ExpressionWrapper","output_mode":"content","-n":true,"-C":4}
```
  - ↩ result:
```text
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py-297-        If a source's output field resolves to None, exclude it from this check.
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py-298-        If all sources are None, then an error is raised higher up the stack in
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py-299-        the output_field property.
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py-300-        """
django/db/models/expressions.py:301:        
…[4494 more chars]
```


**judge/main:** Both probes verified — I confirmed the cited lines in `django/db/models/expressions.py` (L301-307 mixed-types error, L460-462 the existing `as_sql` temporal dispatch) and `tests/expressions/tests.py` (L1494-1499, L1523-1527) exist verbatim at the base commit.

#### judge/main → **final verdict**
```json
{
  "underspecified": 1,
  "underspecified_rationale": "The issue title states the goal explicitly (\"make temporal subtraction work without ExpressionWrapper\") and gives a concrete reproduction plus the exact FieldError. With repo access, the root cause is easy to locate: CombinedExpression.as_sql already contains the type dispatch (`datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}` → TemporalSubtraction, and mixed DurationField → DurationExpression) but this happens only at SQL-compile time, so `Expression._resolve_output_field` (django/db/models/expressions.py:L301-311) raises before it. The natural fix is to make that dispatch/output_field inference happen at resolve time. Minor blank: the issue only shows DateTimeField, so the solver must infer the fix should generalize to DateField/TimeField/subqueries — but the pre-existing as_sql dispatch and existing ExpressionWrapper-based tests in tests/expressions/tests.py make that generalization the obvious reading.",
  "false_negative": 1,
  "false_negative_rationale": "The FAIL_TO_PASS tests assert only end-to-end behavior — filtered result sets ({'e2','e3','e4'}), `assertIsNone(queryset.first().difference)`, `assertTrue(queryset.exists())`, `assertEqual(e.delta, delta)` — and never reference gold-patch internals such as TemporalSubtraction, DurationExpression, generated SQL, or error strings. So alternative implementations (e.g. overriding `_resolve_output_field`/`output_field` on CombinedExpression to return DurationField for SUB of matching temporal types, while leaving the existing as_sql dispatch in place) would pass. Docked one point because the tests exercise a broader surface than the single issue example: subquery subtraction (`subquery - F('completed')`), Case-based subtraction, TimeField/DateField, and `Value(None, output_field=...)` nulls. A fix narrowly targeting only the DateTimeField `F('end') - F('start') + Value(timedelta())` example would fail several tests — though following the existing `datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}` convention in the same function is the natural approach.",
  "evidence": [
    {
      "axis": "underspecified",
      "source": "repo",
      "ref": "django/db/models/expressions.py:L460-L462",
      "claim": "The temporal-subtraction dispatch already exists in CombinedExpression.as_sql, making the required change (moving/duplicating it so output_field is inferable) discoverable from the issue text.",
      "quote": "datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}"
    },
    {
      "axis": "underspecified",
      "source": "repo",
      "ref": "django/db/models/expressions.py:L301-L307",
      "claim": "The error quoted in the issue originates in Expression._resolve_output_field, which runs before as_sql and is unaware of the CombinedExpression dispatch.",
      "quote": "'Expression contains mixed types: %s, %s. You must '"
    },
    {
      "axis": "false_negative",
      "source": "test_patch",
      "ref": "tests/expressions/tests.py",
      "claim": "Tests cover subquery subtraction, which is beyond the issue's single F()-F() DateTimeField example.",
      "quote": "difference=subquery - F('completed'),"
    },
    {
      "axis": "false_negative",
      "source": "repo",
      "ref": "tests/expressions/tests.py:L1494-L1499",
      "claim": "The pre-existing tests use ExpressionWrapper around exactly the temporal subtractions the fix must make work bare, so the target behavior is behavioral, not implementation-pinned.",
      "quote": "                F('completed') - F('assigned'), output_field=DurationField()"
    }
  ],
  "decision": "usable",
  "confidence": 4
}
```


## Result
- subtype: success · turns: 6 · 173s · cost $0.578 · tokens in/out/cache: 6/4910/32729

### ✅ Verification passed