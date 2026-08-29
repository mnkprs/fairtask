# Trajectory — django__django-13128 — v7-sonnet-nocal (v7-sonnet-nocal)
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

- **session** `86c6f44d-12a3-4201-9d48-2f2d5db3a1d6` · tools: Task, Glob, Grep, Read, StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup, spec-probe, test-probe

**judge/main:** I'll dispatch both probes in parallel.

#### judge/main → dispatch `spec-probe` (Spec probe django-13128)
```text
Assess the underspecified axis for this benchmark candidate.

Repository: django/django at commit 2d67222472f80f251607ae1b720527afceba06ad (version 3.2). Repo is available locally in the working directory.

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

## Gold patch (solver does NOT see)
diff --git a/django/db/models/expressions.py b/django/db/models/expressions.py
--- a/django/db/mode
…[4594 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"class CombinedExpression|class TemporalSubtraction|class DurationExpression|_resolve_output_field|has_native_duration_field","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
269:        output_field = self._resolve_output_field()
279:        _resolve_output_field() didn't return an output type.
287:    def _resolve_output_field(self):
425:class CombinedExpression(SQLiteNumericMixin, Expression):
455:            not connection.features.has_native_duration_field and
484:class DurationExpression(CombinedExpression):
512:class TemporalSubtraction(CombinedExpression):
1051:    def _resolve_output_field(self):
1233:    def _resolve_output_field(self):
```


- subagent:spec-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprakspaces/django__django-13128/repo/django/db/models/expressions.py","offset":240,"limit":330}
```
  - ❌ error:
```text
File does not exist. Note: your current working directory is /Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo.
```


- subagent:spec-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":240,"limit":330}
```
  - ↩ result:
```text
240	         * query: the backend query implementation
241	         * allow_joins: boolean allowing or denying use of joins
242	           in this query
243	         * reuse: a set of reusable joins for multijoins
244	         * summarize: a terminal aggregate clause
245	         * for_save: whether this expression about to be used in a save or update
246	
247	        Return: an Expression to be added to the query.
248	        """
249	        c = self.copy()
250	        c.is_summary = summarize
251	        c.set_source_expressions([
252	            expr.resolve_expression(query, allow_joins, reuse, summarize)
253	            if expr else None
254	            for expr in c.get_source_expressi
…[5324 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"def test_date_subtraction|def test_date_case_subtraction|def test_date_subquery_subtraction|def test_time_subtraction|def test_time_subquery_subtraction|def test_datetime_subquery_subtraction|def test_datetime_subtraction_microseconds","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","-n":true,"-A":20}
```
  - ↩ result:
```text
Found 1 file
tests/expressions/tests.py
```


#### judge/main → dispatch `test-probe` (Test probe django-13128)
```text
Assess the false_negative axis for this benchmark candidate.

Repository: django/django at commit 2d67222472f80f251607ae1b720527afceba06ad (version 3.2). Repo available locally.

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

## Gold patch (solver does NOT see)
diff --git a/django/db/models/expressions.py b/django/db/models/expressions.py
--- a/django/db/models/expressions.py
+++ b/djan
…[5804 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"def test_date_subtraction|def test_date_case_subtraction|def test_date_subquery_subtraction|def test_time_subtraction|def test_time_subquery_subtraction|def test_datetime_subquery_subtraction|def test_datetime_subtraction_microseconds","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true,"-A":20}
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
…[5322 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"class CombinedExpression|class DurationExpression|class TemporalSubtraction","path":"/Users/manoskaparos/Projects/taskprakos/workspaces/django__django-13128/repo/django/db/models/expressions.py","output_mode":"content","-n":true}
```
  - ❌ error:
```text
<tool_use_error>Path does not exist: /Users/manoskaparos/Projects/taskprakos/workspaces/django__django-13128/repo/django/db/models/expressions.py. Note: your current working directory is /Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo.</tool_use_error>
```


- subagent:test-probe → `Grep` ```json
{"pattern":"class FTimeDeltaTests|def test_date_subtraction|def test_date_case_subtraction|def test_date_subquery_subtraction|def test_time_subtraction|def test_time_subquery_subtraction|def test_datetime_subtraction|def test_datetime_subquery_subtraction|def test_datetime_subtraction_microseconds","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
1290:class FTimeDeltaTests(TestCase):
1494:    def test_date_subtraction(self):
1523:    def test_date_subquery_subtraction(self):
1533:    def test_date_case_subtraction(self):
1550:    def test_time_subtraction(self):
1576:    def test_time_subquery_subtraction(self):
1587:    def test_datetime_subtraction(self):
1611:    def test_datetime_subquery_subtraction(self):
1621:    def test_datetime_subtraction_microseconds(self):
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","offset":1290,"limit":380}
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
…[5325 more chars]
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":400,"limit":140}
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
…[4905 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"_resolve_output_field|def output_field","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","output_mode":"content","-n":true,"-C":3}
```
  - ↩ result:
```text
264-        return self.output_field
265-
266-    @cached_property
267:    def output_field(self):
268-        """Return the output type of this expressions."""
269:        output_field = self._resolve_output_field()
270-        if output_field is None:
271-            self._output_field_resolved_to_none = True
272-            raise FieldError('Cannot resolve expression type, unknown output_field')
--
276-    def _output_field_or_none(self):
277-        """
278-        Return the output field of this expression, or None if
279:        _resolve_output_field() didn't return an output type.
280-        """
281-        try:
282-            return self.output_field
--
284-            if not self.
…[777 more chars]
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":287,"limit":45}
```
  - ↩ result:
```text
287	    def _resolve_output_field(self):
288	        """
289	        Attempt to infer the output type of the expression. If the output
290	        fields of all source fields match then, simply infer the same type
291	        here. This isn't always correct, but it makes sense most of the time.
292	
293	        Consider the difference between `2 + 2` and `2 / 3`. Inferring
294	        the type here is a convenience for the common case. The user should
295	        supply their own output_field with more complex computations.
296	
297	        If a source's output field resolves to None, exclude it from this check.
298	        If all sources are None, then an error is raised higher up the stack
…[1575 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"supports_temporal_subtraction","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","-n":true}
```
  - ↩ result:
```text
Found 1 file
tests/expressions/tests.py
```


- subagent:test-probe → `Grep` ```json
{"pattern":"delta=F\\('end'\\) - F\\('start'\\)|F\\('end'\\) - F\\('start'\\) \\+ Value|test_mixed_type_annotation","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
No matches found
```

  - ↩ result (subagent report):
```text
Based on my inspection, I have enough evidence to assess this.

**Score:** 1 — The issue's title states a clear general intent ("make temporal subtraction work without ExpressionWrapper"), which a careful reader can generalize to all the temporal-subtraction scenarios the tests exercise, but the reported reproduction case is narrower than the fix's actual required scope, leaving some blanks about breadth/edge-cases.

**Evidence:**
- The issue only reproduces one specific failure mode (mixed `DateTimeField`/`DurationField` when a subtraction is combined with an explicit `Value(..., output_field=DurationField())`), not the plain-subtraction case. `issue`: `"Expression contains mixed types: DateTimeField, DurationField. You must set output_field."`
- Before the patch, plain `F('completed') - F('assigned')` (no `Value` addition) does *not* raise this FieldError at all — `_resolve_output_field` sees two matching `DateField` sources and returns `DateField`, silently wrong (should be `DurationField`), rather than the error shown in the issue. `django/db/models/expressions.py:L301-L312` — `"for output_field in sources_iter: for source in sources_iter: if not isinstance(output_field, source.__class__): raise FieldError(...) return output_field"`
- The actual bug the gold patch fixes is a deeper inconsistency: `as_sql` special-cases temporal subtraction/duration promotion using `self.lhs.output_field`/`self.rhs.output_field` directly, but `resolve_expression` never applies this promotion, so `.output_field` (used for filtering/lookups) can diverge from what SQL generation actually does. `django/db/models/expressions.py:L445-L462` (old `as_sql` mixed-type/datetime-field detection) vs `L476-L481` (old `resolve_expression`, no promotion) — `"c.lhs = c.lhs.resolve_expression(...)\n c.rhs = c.rhs.resolve_expression(...)\n return c"`.
- The gold patch moves the entire detection logic into `resolve_expression`, actually replacing the `CombinedExpression` with a `TemporalSubtraction`/`DurationExpression` instance at resolution time — a nontrivial refactor not hinted at by the issue text. `gold_patch`: `"if 'DurationField' in {lhs_type, rhs_type} and lhs_type != rhs_type: return DurationExpression(...).resolve_expression(...)"` and `"if self.connector == self.SUB and lhs_type in datetime_fields ...: return TemporalSubtraction(...).resolve_expression(...)"`.
- The test patch (and FAIL_TO_PASS list) validates a much broader set of scenarios than the issue's single reproduction — subquery subtraction, `Case`-based subtraction, `TimeField` subtraction, and microsecond-precision `DateTimeField` subtraction all must drop `ExpressionWrapper` and just work — none of which are mentioned or implied concretely in the issue body. `test_patch`: `test_date_subquery_subtraction`, `test_date_case_subtraction`, `test_time_subtraction`, `test_time_subquery_subtraction`, `test_datetime_subquery_subtraction`, `test_datetime_subtraction_microseconds` all replace `ExpressionWrapper(expr
…[1126 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"TemporalSubtraction|DurationExpression","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests","output_mode":"content","-n":true}
```
  - ↩ result:
```text
No matches found
```

  - ↩ result (subagent report):
```text
# False Negative Assessment: django__django-13128

**Score: 0** — the tests validate externally-observable query behavior (annotation values, filter results, subquery/Case composition) that directly matches the issue's stated general goal ("make temporal subtraction work without ExpressionWrapper"), with no coupling to gold-patch-specific internals.

## Analysis

**What the tests actually check.** All seven FAIL_TO_PASS tests in `tests/expressions/tests.py::FTimeDeltaTests` (e.g. `test_date_subtraction` at `tests/expressions/tests.py:1494-1520`, `test_datetime_subtraction` at `:1587-1608`, `test_date_subquery_subtraction` at `:1523-1530`, `test_date_case_subtraction` at `:1533-1547`) were changed only by stripping the `ExpressionWrapper(..., output_field=DurationField())` boilerplate around `F(x) - F(y)` and asserting the same query results as before (timedelta comparisons, subquery existence, Case matching, microsecond precision). None of them inspect internal classes, attribute names, or SQL text — e.g. `grep` for `TemporalSubtraction|DurationExpression` in `tests/` returns no matches.

**Root cause matches issue title exactly.** In the pre-fix `django/db/models/expressions.py:445-462`, `CombinedExpression.as_sql` already dispatches correctly to `TemporalSubtraction`/`DurationExpression` for SQL generation, using `self.lhs.output_field`/`self.rhs.output_field` at as_sql time. But the *output_field* of the outer annotation itself is computed via the generic `BaseExpression._resolve_output_field` (`django/db/models/expressions.py:287-312`), which for two matching `DateField`s just returns `DateField` — never `DurationField` — because the SQL-dispatch specialization never runs before output_field resolution. This is precisely what the issue's title states needs fixing ("make temporal subtraction work without ExpressionWrapper"), not just the narrower mixed-Duration snippet in the issue body.

**Alternative implementation check.** A competent engineer could fix this by overriding `_resolve_output_field` on `CombinedExpression` (returning `DurationField()` for matching-datetime-SUB and mixed-Duration cases) rather than moving the dispatch into `resolve_expression` as the gold patch does. Because:
- `TemporalSubtraction.output_field = fields.DurationField()` is already a plain class attribute present even in the pre-fix code (`django/db/models/expressions.py:512-513`), and
- the as_sql dispatch logic based on `self.lhs`/`self.rhs` (already resolved by the time `as_sql` runs) is unchanged in effect,

such an alternative produces identical query results for every FAIL_TO_PASS test (bare `F()-F()` filtering, Subquery subtraction, Case subtraction, microsecond precision) since these tests only assert on `.first()`, `.get()`, `.filter().exists()`, and equality checks against Python objects, never on the concrete Python class of the resolved expression.

**Coverage matches scope of a general fix.** Because the tests span Date/Time/DateTime, plain-field/Sub
…[958 more chars]
```


**judge/main:** Let me spot-check the strongest claims.

- judge/main → `Read` ```json
{"file_path":"/home/user/django/django/db/models/expressions.py","offset":285,"limit":30}
```
  - ❌ error:
```text
File does not exist. Note: your current working directory is /Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo.
```


- judge/main → `Read` ```json
{"file_path":"/home/user/django/django/db/models/expressions.py","offset":435,"limit":90}
```
  - ❌ error:
```text
File does not exist. Note: your current working directory is /Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo.
```


- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":290,"limit":25}
```
  - ↩ result:
```text
290	        fields of all source fields match then, simply infer the same type
291	        here. This isn't always correct, but it makes sense most of the time.
292	
293	        Consider the difference between `2 + 2` and `2 / 3`. Inferring
294	        the type here is a convenience for the common case. The user should
295	        supply their own output_field with more complex computations.
296	
297	        If a source's output field resolves to None, exclude it from this check.
298	        If all sources are None, then an error is raised higher up the stack in
299	        the output_field property.
300	        """
301	        sources_iter = (source for source in self.get_source_fields() if
…[599 more chars]
```


- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":440,"limit":80}
```
  - ↩ result:
```text
440	        return [self.lhs, self.rhs]
441	
442	    def set_source_expressions(self, exprs):
443	        self.lhs, self.rhs = exprs
444	
445	    def as_sql(self, compiler, connection):
446	        try:
447	            lhs_type = self.lhs.output_field.get_internal_type()
448	        except FieldError:
449	            lhs_type = None
450	        try:
451	            rhs_type = self.rhs.output_field.get_internal_type()
452	        except FieldError:
453	            rhs_type = None
454	        if (
455	            not connection.features.has_native_duration_field and
456	            'DurationField' in {lhs_type, rhs_type} and
457	            lhs_type != rhs_type
458	        ):
459	            r
…[2807 more chars]
```


**judge/main:** Both probes' key claims verified against the base commit: `as_sql` (L445-462) already dispatches to `TemporalSubtraction`/`DurationExpression`, while `resolve_expression` (L476-481) does not, and `_resolve_output_field` (L301-312) produces the mixed-types error. The hidden tests only assert query results (no reference to `TemporalSubtraction`/`DurationExpression` internals or SQL text).

#### judge/main → **final verdict**
```json
{
  "underspecified": 1,
  "underspecified_rationale": "The issue title states the goal plainly — \"make temporal subtraction work without ExpressionWrapper\" — and the traceback pinpoints the mechanism: output_field resolution for a temporal subtraction combined with a DurationField value goes through BaseExpression._resolve_output_field (django/db/models/expressions.py:L301-L312) which raises \"Expression contains mixed types\". An engineer with repo access can see that CombinedExpression.as_sql (L445-L462) already special-cases datetime SUB -> TemporalSubtraction and mixed-Duration -> DurationExpression, but that CombinedExpression.resolve_expression (L476-L481) does no such promotion, so the annotation's output_field is wrong. The natural fix (promote in resolve_expression, or override _resolve_output_field) follows directly. The blank to fill in is scope: the issue's reproduction uses the `+ Value(timedelta())` form, whereas the hidden tests exercise bare F()-F(), Subquery, Case, Time/Date/DateTime and microsecond precision. The title generalizes, so a sensible interpretation exists, but a solver could plausibly patch only the reported combination.",
  "false_negative": 1,
  "false_negative_rationale": "The test patch only strips ExpressionWrapper(..., output_field=DurationField()) wrappers and keeps the pre-existing assertions (e.g. assertEqual(less_than_5_days, {'e0','e1','e2'}), assertIsNone(queryset.first().difference), assertTrue(queryset.exists()), assertEqual(e.delta, delta)). No assertion references TemporalSubtraction, DurationExpression, resolve_expression, or generated SQL, so an alternative implementation — e.g. overriding CombinedExpression._resolve_output_field to return DurationField() for datetime-SUB-datetime and mixed-Duration cases while leaving the as_sql dispatch in place — passes identically since TemporalSubtraction.output_field = fields.DurationField() already exists at L512-L513. The only solutions excluded are ones narrowly special-casing the exact snippet in the issue body, which would not satisfy the issue title anyway. Slight residual risk because the tests demand generality (Subquery, Case operands) beyond the literal reproduction.",
  "evidence": [
    {
      "axis": "underspecified",
      "source": "repo",
      "ref": "django/db/models/expressions.py:L476-L481",
      "claim": "CombinedExpression.resolve_expression performs no type promotion at the base commit, while as_sql does — the discrepancy the issue implicitly points at.",
      "quote": "    def resolve_expression(self, query=None, allow_joins=True, reuse=None, summarize=False, for_save=False):\n        c = self.copy()\n        c.is_summary = summarize\n        c.lhs = c.lhs.resolve_expression(query, allow_joins, reuse, summarize, for_save)\n        c.rhs = c.rhs.resolve_expression(query, allow_joins, reuse, summarize, for_save)\n        return c"
    },
    {
      "axis": "false_negative",
      "source": "repo",
      "ref": "django/db/models/expressions.py:L512-L516",
      "claim": "TemporalSubtraction already declares DurationField output at the base commit, so alternative fixes that only correct output_field resolution yield the same observable results the tests assert on.",
      "quote": "class TemporalSubtraction(CombinedExpression):\n    output_field = fields.DurationField()"
    }
  ],
  "decision": "usable",
  "confidence": 4
}
```


## Result
- subtype: success · turns: 8 · 218s · cost $0.718 · tokens in/out/cache: 8/7224/54017

### ✅ Verification passed