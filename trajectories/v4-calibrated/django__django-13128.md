# Trajectory — django__django-13128 — v4-calibrated (v4-calibrated)
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

- **session** `9e4ba0ab-324f-433e-8946-b247541d20fe` · tools: Task, Glob, Grep, Read, StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup, spec-probe, test-probe

**judge/main:** I'll dispatch both probes in parallel.

#### judge/main → dispatch `spec-probe` (Assess issue specification)
```text
Assess whether the issue text alone is well-specified enough for an engineer (full repo access, no clarification possible) to attempt a fix.

Repository: django/django at commit 2d67222472f80f251607ae1b720527afceba06ad (version 3.2). Working dir is the repo.

## Issue text (ALL the solver sees)
'''
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
'''

## Gold patch (solver does NOT see)
'''diff
diff --git a/django/db/model
…[4158 more chars]
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
{"pattern":"class TemporalSubtraction|class DurationExpression|class CombinedExpression|def _resolve_output_field","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
287:    def _resolve_output_field(self):
425:class CombinedExpression(SQLiteNumericMixin, Expression):
484:class DurationExpression(CombinedExpression):
512:class TemporalSubtraction(CombinedExpression):
1051:    def _resolve_output_field(self):
1233:    def _resolve_output_field(self):
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"ExpressionWrapper","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/docs","output_mode":"content","-n":true,"head_limit":40}
```
  - ↩ result:
```text
docs/ref/models/expressions.txt:218::class:`ExpressionWrapper`::
docs/ref/models/expressions.txt:220:    from django.db.models import DateTimeField, ExpressionWrapper, F
docs/ref/models/expressions.txt:223:        expires=ExpressionWrapper(
docs/ref/models/expressions.txt:489:``ExpressionWrapper()`` expressions
docs/ref/models/expressions.txt:492:.. class:: ExpressionWrapper(expression, output_field)
docs/ref/models/expressions.txt:494:``ExpressionWrapper`` surrounds another expression and provides access to
docs/ref/models/expressions.txt:496:expressions. ``ExpressionWrapper`` is necessary when using arithmetic on
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"ExpressionWrapper\\(.*DurationField|TemporalSubtraction","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true,"head_limit":40}
```
  - ↩ result:
```text
1625:            delta=ExpressionWrapper(F('end') - F('start'), output_field=DurationField())
```


- subagent:spec-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/docs/ref/models/expressions.txt","offset":205,"limit":25}
```
  - ↩ result:
```text
205	
206	Using ``F()`` with annotations
207	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
208	
209	``F()`` can be used to create dynamic fields on your models by combining
210	different fields with arithmetic::
211	
212	    company = Company.objects.annotate(
213	        chairs_needed=F('num_employees') - F('num_chairs'))
214	
215	If the fields that you're combining are of different types you'll need
216	to tell Django what kind of field will be returned. Since ``F()`` does not
217	directly support ``output_field`` you will need to wrap the expression with
218	:class:`ExpressionWrapper`::
219	
220	    from django.db.models import DateTimeField, ExpressionWrapper, F
221	
222	    Ticket.objects.annotate(
223
…[333 more chars]
```


- subagent:spec-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","offset":1600,"limit":60}
```
  - ↩ result:
```text
1600	            output_field=DurationField(),
1601	        ))
1602	        self.assertIsNone(queryset.first().difference)
1603	
1604	        queryset = Experiment.objects.annotate(shifted=ExpressionWrapper(
1605	            F('start') - Value(None, output_field=DurationField()),
1606	            output_field=DateTimeField(),
1607	        ))
1608	        self.assertIsNone(queryset.first().shifted)
1609	
1610	    @skipUnlessDBFeature('supports_temporal_subtraction')
1611	    def test_datetime_subquery_subtraction(self):
1612	        subquery = Experiment.objects.filter(pk=OuterRef('pk')).values('start')
1613	        queryset = Experiment.objects.annotate(
1614	            difference=Expressio
…[2319 more chars]
```


#### judge/main → dispatch `test-probe` (Assess test scoping)
```text
Assess whether the hidden tests would accept all reasonable solutions to the issue, or only the gold patch's particular choices (false_negative axis).

Repository: django/django at commit 2d67222472f80f251607ae1b720527afceba06ad (version 3.2). Working dir is the repo.

## Issue text (ALL the solver sees)
'''
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
'''

## Gold patch
'''diff
diff --git a/django/db/models/expression
…[5910 more chars]
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":280,"limit":280}
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


- subagent:test-probe → `Grep` ```json
{"pattern":"_resolve_output_field|_resolve_combined_type|NON_COMBINABLE","output_mode":"content","-n":true}
```
  - ↩ result:
```text
django/db/models/functions/window.py:47:    def _resolve_output_field(self):
django/db/models/functions/window.py:77:    def _resolve_output_field(self):
django/db/models/functions/mixins.py:44:    def _resolve_output_field(self):
django/db/models/functions/mixins.py:50:        return super()._resolve_output_field() if source_fields else FloatField()
django/db/models/expressions.py:269:        output_field = self._resolve_output_field()
django/db/models/expressions.py:279:        _resolve_output_field() didn't return an output type.
django/db/models/expressions.py:287:    def _resolve_output_field(self):
django/db/models/expressions.py:1051:    def _resolve_output_field(self):
django/db/mode
…[59 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"def test_date_subtraction|def test_date_subquery_subtraction|def test_date_case_subtraction|def test_time_subtraction|def test_time_subquery_subtraction|def test_datetime_subtraction|def test_datetime_subquery_subtraction|def test_datetime_subtraction_microseconds|def test_duration_with_datetime|def test_duration_expressions|def test_delta_add|def test_mixed_comparisons\",Add\n<parameter name=\"path\">/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
No matches found
```


- subagent:test-probe → `Grep` ```json
{"pattern":"def test_(date|time|datetime)_(sub|case|subquery)","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true}
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
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","offset":1400,"limit":260}
```
  - ↩ result:
```text
1400	
1401	            test_set = [e.name for e in Experiment.objects.filter(end__lte=F('start') + delta)]
1402	            self.assertEqual(test_set, self.expnames[:i + 1])
1403	
1404	    def test_delta_subtract(self):
1405	        for i, delta in enumerate(self.deltas):
1406	            test_set = [e.name for e in Experiment.objects.filter(start__gt=F('end') - delta)]
1407	            self.assertEqual(test_set, self.expnames[:i])
1408	
1409	            test_set = [e.name for e in Experiment.objects.filter(start__gte=F('end') - delta)]
1410	            self.assertEqual(test_set, self.expnames[:i + 1])
1411	
1412	    def test_exclude(self):
1413	        for i, delta in enumerate(self.deltas)
…[5324 more chars]
```

  - ↩ result (subagent report):
```text
## Report

- **Score:** 0 — The title states the desired behaviour outright ("make temporal subtraction work without ExpressionWrapper"), the snippet is a runnable repro with the exact current error, and the pre-fix code already enumerates precisely which temporal cases must be supported, so the required change (do the temporal/duration dispatch before output-field resolution instead of only at SQL-compile time) is discoverable without guessing.

- **Evidence:**
  - The issue gives a complete model, query, and the exact exception, so "success" is unambiguous: the annotation must resolve to a duration instead of raising — `issue`: "Experiment.objects.annotate(\n\tdelta=F('end') - F('start') + Value(datetime.timedelta(), output_field=DurationField())\n)\n\nThis gives:\ndjango.core.exceptions.FieldError: Expression contains mixed types: DateTimeField, DurationField. You must set output_field."
  - The error text in the issue points straight at the single site that raises it, making the failure mechanism (output-field inference runs before any temporal special-casing) easy to locate — `django/db/models/expressions.py:L301-L311`: "for output_field in sources_iter:\n            for source in sources_iter:\n                if not isinstance(output_field, source.__class__):\n                    raise FieldError(\n                        'Expression contains mixed types: %s, %s. You must '\n                        'set output_field.'"
  - The codebase already contains the exact dispatch logic the fix must relocate, including the full set of temporal field types and the duration-mixed case, so scope (Date/DateTime/Time, duration mixing) is resolved by the repo rather than left open — `django/db/models/expressions.py:L445-L462`: "if (\n            not connection.features.has_native_duration_field and\n            'DurationField' in {lhs_type, rhs_type} and\n            lhs_type != rhs_type\n        ):\n            return DurationExpression(...)\n        datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}\n        if self.connector == self.SUB and lhs_type in datetime_fields and lhs_type == rhs_type:"
  - `resolve_expression` at the pre-fix commit does nothing type-aware, which is the obvious hook for a solver who knows dispatch must happen before `output_field` is queried — `django/db/models/expressions.py:L476-L481`: "c = self.copy()\n        c.is_summary = summarize\n        c.lhs = c.lhs.resolve_expression(query, allow_joins, reuse, summarize, for_save)\n        c.rhs = c.rhs.resolve_expression(query, allow_joins, reuse, summarize, for_save)\n        return c"
  - The hidden tests only delete the `ExpressionWrapper(..., output_field=DurationField())` wrappers from existing tests, i.e. exactly the behaviour named in the issue title; existing tests show the wrapper idiom being removed — `tests/expressions/tests.py:L1620-L1626`: "delta=ExpressionWrapper(F('end') - F('start'), output_field=DurationField())" (test patch drops the wrapper).
  - The o
…[1384 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"output_field|def resolve_expression|def get_internal_type","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/sql/query.py","output_mode":"content","-n":true,"head_limit":40}
```
  - ↩ result:
```text
233:    def output_field(self):
238:            return next(iter(self.annotation_select.values())).output_field
1024:    def resolve_expression(self, query, *args, **kwargs):
1193:            output_field = lhs.output_field.__class__
1194:            suggested_lookups = difflib.get_close_matches(name, output_field.get_lookups())
1201:                "permitted%s" % (name, output_field.__name__, suggestion)
1451:                    field = self.annotation_select[name].output_field
1838:        self.values_select += col.output_field.name,
```


- subagent:test-probe → `Grep` ```json
{"pattern":"supports_temporal_subtraction|has_native_duration_field","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/backends","output_mode":"content","-n":true}
```
  - ↩ result:
```text
django/db/backends/base/features.py:69:    has_native_duration_field = False
django/db/backends/base/features.py:73:    supports_temporal_subtraction = False
django/db/backends/oracle/features.py:17:    has_native_duration_field = True
django/db/backends/oracle/features.py:33:    supports_temporal_subtraction = True
django/db/backends/base/operations.py:633:        if self.connection.features.supports_temporal_subtraction:
django/db/backends/sqlite3/features.py:28:    supports_temporal_subtraction = True
django/db/backends/mysql/features.py:24:    supports_temporal_subtraction = True
django/db/backends/postgresql/features.py:14:    has_native_duration_field = True
django/db/backends/postgres
…[58 more chars]
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/sql/query.py","offset":225,"limit":25}
```
  - ↩ result:
```text
225	
226	        self._filtered_relations = {}
227	
228	        self.explain_query = False
229	        self.explain_format = None
230	        self.explain_options = {}
231	
232	    @property
233	    def output_field(self):
234	        if len(self.select) == 1:
235	            select = self.select[0]
236	            return getattr(select, 'target', None) or select.field
237	        elif len(self.annotation_select) == 1:
238	            return next(iter(self.annotation_select.values())).output_field
239	
240	    @property
241	    def has_select_fields(self):
242	        return bool(self.select or self.annotation_select_mask or self.extra_select_mask)
243	
244	    @cached_property
245	    def b
…[118 more chars]
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/sql/query.py","offset":1015,"limit":30}
```
  - ↩ result:
```text
1015	        return alias or seen[None]
1016	
1017	    def add_annotation(self, annotation, alias, is_summary=False):
1018	        """Add a single annotation expression to the Query."""
1019	        annotation = annotation.resolve_expression(self, allow_joins=True, reuse=None,
1020	                                                   summarize=is_summary)
1021	        self.append_annotation_mask([alias])
1022	        self.annotations[alias] = annotation
1023	
1024	    def resolve_expression(self, query, *args, **kwargs):
1025	        clone = self.clone()
1026	        # Subqueries need to use a different set of aliases than the outer query.
1027	        clone.bump_prefix(query)
1028	        clo
…[1036 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"_output_field_or_none|_output_field_resolved_to_none","output_mode":"content","-n":true}
```
  - ↩ result:
```text
django/db/models/aggregates.py:33:        return [e._output_field_or_none for e in super().get_source_expressions()]
django/db/models/expressions.py:159:    _output_field_resolved_to_none = False
django/db/models/expressions.py:271:            self._output_field_resolved_to_none = True
django/db/models/expressions.py:276:    def _output_field_or_none(self):
django/db/models/expressions.py:284:            if not self._output_field_resolved_to_none:
django/db/models/expressions.py:362:        return [e._output_field_or_none for e in self.get_source_expressions()]
django/db/models/expressions.py:692:        output_field = self._output_field_or_none
django/db/models/expressions.py:856:        if
…[591 more chars]
```


- subagent:test-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":255,"limit":30}
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
…[326 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"def set_values|def add_fields","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/sql/query.py","output_mode":"content","-n":true,"-A":30}
```
  - ↩ result:
```text
1851:    def add_fields(self, field_names, allow_m2m=True):
1852-        """
1853-        Add the given (model) fields to the select set. Add the field names in
1854-        the order specified.
1855-        """
1856-        alias = self.get_initial_alias()
1857-        opts = self.get_meta()
1858-
1859-        try:
1860-            cols = []
1861-            for name in field_names:
1862-                # Join promotion note - we must not remove any rows here, so
1863-                # if there is no existing joins, use outer join.
1864-                join_info = self.setup_joins(name.split(LOOKUP_SEP), opts, alias, allow_many=allow_m2m)
1865-                targets, final_alias, joins = s
…[2229 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"mixed types|Cannot resolve expression type|must set output_field|set output_field","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests","output_mode":"content","-n":true,"-C":4,"head_limit":80}
```
  - ↩ result:
```text
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/aggregation/tests.py-848-        book = Book.objects.annotate(val=Max(2, output_field=IntegerField())).first()
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/aggregation/tests.py-849-        self.assertEqual(book.val, 2)
/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/aggregation/tests.py-850-
tests/aggregation/tests.py-851-    def test_missing_output_field_raises_error(self):
tests/aggregation/tests.py:852:        with self.assertRaisesMessage(FieldError, 'Cannot resolve expression type, unknown output_field'):
/Users/manoskaparos/Projects/ta
…[2899 more chars]
```

  - ↩ result (subagent report):
```text
## Report

**Score:** 1 — The tests are purely behavioural (same expected values, wrappers removed) and pin no new names/messages, so nearly any fix that makes `datetime - datetime` resolve to a `DurationField` passes; the only real risk is that three of the seven FAIL_TO_PASS tests exercise a `Subquery`/`Query` operand that the issue never mentions and that some natural `_resolve_output_field` implementations would crash on.

**Evidence:**

- The issue asks only that temporal subtraction stop requiring an explicit `output_field`, and the tests do exactly that — the same assertions with the wrapper removed. `issue`: `"make temporal subtraction work without ExpressionWrapper ... django.core.exceptions.FieldError: Expression contains mixed types: DateTimeField, DurationField. You must set output_field."`
- No new API surface, exception class, message, parameter name or SQL string is asserted; the FAIL_TO_PASS assertions are value equality on pre-existing fixtures, e.g. `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py:L1550-L1561`: `queryset = Time.objects.annotate(` ... `self.assertEqual(` / `queryset.get().difference,` / `datetime.timedelta(hours=1, minutes=15, seconds=15, microseconds=2345)`. Any implementation that yields a `DurationField`-typed expression compiled through `subtract_temporals` satisfies these.
- The gold patch's specific choice — moving dispatch from `as_sql` to `resolve_expression` — is **not** required by the tests. The pre-existing `as_sql` dispatch already produced correct SQL; only output-field inference was missing. `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py:L460-L462`: `datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}` / `if self.connector == self.SUB and lhs_type in datetime_fields and lhs_type == rhs_type:` / `return TemporalSubtraction(self.lhs, self.rhs).as_sql(compiler, connection)`. Alternative fix #1 — leave `as_sql` alone and add `_resolve_output_field()` to `CombinedExpression` returning `fields.DurationField()` for same-type temporal `SUB` (and the temporal type for temporal±duration, which is the Django 4.0 `_resolve_combined_type` approach) — produces byte-identical SQL and identical converters (`TemporalSubtraction` merely sets `output_field = fields.DurationField()`, `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py:L512-L513`), so all 7 FAIL_TO_PASS tests pass.
- Alternative fix #2 — dispatch at `resolve_expression` like gold but without the `has_native_duration_field` short-circuit gold added to `DurationExpression.as_sql` (`gold_patch`: `if connection.features.has_native_duration_field:` / `return super().as_sql(compiler, connection)`) — also passes on SQLite/MySQL; that hunk only affects PostgreSQL/Oracle and no FAIL_TO_PASS test depends on it.
- The one genuine trap: three FAIL_TO_PASS tests use a `QuerySet` as th
…[3023 more chars]
```


**judge/main:** Let me spot-check the key cited locations.

- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":295,"limit":20}
```
  - ↩ result:
```text
295	        supply their own output_field with more complex computations.
296	
297	        If a source's output field resolves to None, exclude it from this check.
298	        If all sources are None, then an error is raised higher up the stack in
299	        the output_field property.
300	        """
301	        sources_iter = (source for source in self.get_source_fields() if source is not None)
302	        for output_field in sources_iter:
303	            for source in sources_iter:
304	                if not isinstance(output_field, source.__class__):
305	                    raise FieldError(
306	                        'Expression contains mixed types: %s, %s. You must '
307	            
…[278 more chars]
```


- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":440,"limit":45}
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
…[1355 more chars]
```


- judge/main → `Grep` ```json
{"pattern":"_output_field_or_none|def get_source_fields","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
276:    def _output_field_or_none(self):
360:    def get_source_fields(self):
362:        return [e._output_field_or_none for e in self.get_source_expressions()]
692:        output_field = self._output_field_or_none
856:        if getattr(expression, '_output_field_or_none', True) is None:
911:    def get_source_fields(self):
913:        return [self.result._output_field_or_none]
1015:        if self._output_field_or_none is not None:
```


- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/sql/query.py","offset":228,"limit":14}
```
  - ↩ result:
```text
228	        self.explain_query = False
229	        self.explain_format = None
230	        self.explain_options = {}
231	
232	    @property
233	    def output_field(self):
234	        if len(self.select) == 1:
235	            select = self.select[0]
236	            return getattr(select, 'target', None) or select.field
237	        elif len(self.annotation_select) == 1:
238	            return next(iter(self.annotation_select.values())).output_field
239	
240	    @property
241	    def has_select_fields(self):
```


**judge/main:** Both probes' strongest claims check out: the pre-fix dispatch at `expressions.py:445-462` exists exactly as quoted, `_resolve_output_field` raises the issue's error at L301-311, `get_source_fields` uses `_output_field_or_none` (L360-362) while `sql.Query` exposes only an `output_field` property (query.py:232-238).

#### judge/main → **final verdict**
```json
{
  "underspecified": 0,
  "underspecified_rationale": "The issue title states the goal outright (\"make temporal subtraction work without ExpressionWrapper\"), supplies a complete minimal model + query repro, and quotes the exact exception. The repository resolves any remaining scope questions: django/db/models/expressions.py:L445-L462 already contains the full temporal/duration dispatch (DateField/DateTimeField/TimeField, DurationField mixing) but only at as_sql time, while the FieldError originates earlier in _resolve_output_field (L301-L311). An experienced engineer can therefore see the failure mechanism (output-field inference runs before the temporal special-casing) and the required behaviour (F('end') - F('start') must infer DurationField) without clarification.",
  "false_negative": 1,
  "false_negative_rationale": "The test patch only deletes ExpressionWrapper(..., output_field=DurationField()) wrappers from existing FTimeDeltaTests and keeps the identical assertions (assertEqual on timedelta values, assertIsNone, assertTrue(exists())). No new API, parameter name, error message or SQL string introduced by the gold patch is asserted, so the gold-specific choice of dispatching in resolve_expression rather than adding _resolve_output_field to CombinedExpression is not required, and the has_native_duration_field short-circuit in DurationExpression.as_sql is untested by the FAIL_TO_PASS set. One residual risk keeps this at 1 rather than 0: three of the seven FAIL_TO_PASS tests (test_date/time/datetime_subquery_subtraction) use a QuerySet as lhs, which resolves to a sql.Query that has an output_field property but no _output_field_or_none, so an implementation built on the idiomatic get_source_fields() helper (expressions.py:L360-L362) would raise AttributeError; an implementation mirroring the adjacent as_sql code (self.lhs.output_field) works fine.",
  "evidence": [
    {
      "axis": "underspecified",
      "claim": "The issue gives a complete repro and the exact error, making the required behaviour change unambiguous.",
      "source": "issue",
      "ref": "issue",
      "quote": "django.core.exceptions.FieldError: Expression contains mixed types: DateTimeField, DurationField. You must set output_field."
    },
    {
      "axis": "underspecified",
      "claim": "The repo already contains the exact temporal dispatch logic, but only at as_sql time, so the scope of the fix is discoverable from the code.",
      "source": "repo",
      "ref": "django/db/models/expressions.py:L460-L462",
      "quote": "datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}\n        if self.connector == self.SUB and lhs_type in datetime_fields and lhs_type == rhs_type:\n            return TemporalSubtraction(self.lhs, self.rhs).as_sql(compiler, connection)"
    },
    {
      "axis": "false_negative",
      "claim": "Tests are purely behavioural: the wrappers are removed and the same assertions kept, pinning no gold-patch-specific names.",
      "source": "test_patch",
      "ref": "tests/expressions/tests.py",
      "quote": "completion_duration=F('completed') - F('assigned'),"
    },
    {
      "axis": "false_negative",
      "claim": "Three FAIL_TO_PASS tests use a QuerySet operand; the idiomatic get_source_fields() helper relies on _output_field_or_none, which sql.Query does not provide, so some reasonable implementations could trip on it.",
      "source": "repo",
      "ref": "django/db/models/expressions.py:L360-L362",
      "quote": "def get_source_fields(self):\n        \"\"\"Return the underlying field types used by this aggregate.\"\"\"\n        return [e._output_field_or_none for e in self.get_source_expressions()]"
    }
  ],
  "decision": "usable",
  "confidence": 4
}
```


## Result
- subtype: success · turns: 8 · 300s · cost $1.291 · tokens in/out/cache: 8/7915/62400

### ✅ Verification passed