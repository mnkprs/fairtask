# Trajectory — django__django-13128 — v2-specialists (v2-specialists)
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
…[317 more chars]
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

- **session** `369b3c59-82bf-4821-a55d-fa3d3236fe41` · tools: Task, Glob, Grep, Read, StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup, spec-probe, test-probe

**judge/main:** I'll dispatch both probes in parallel.

#### judge/main → dispatch `spec-probe` (Assess issue specification)
```text
Assess the "underspecified" axis (0-3) for this benchmark candidate. Repo: django/django at commit 2d67222472f80f251607ae1b720527afceba06ad (version 3.2). The solver sees ONLY the issue text and the repo.

## Issue text
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
+++ b
…[4367 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"class CombinedExpression|class DurationExpression|class TemporalSubtraction|def _resolve_output_field|class BaseExpression","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
154:class BaseExpression:
287:    def _resolve_output_field(self):
425:class CombinedExpression(SQLiteNumericMixin, Expression):
484:class DurationExpression(CombinedExpression):
512:class TemporalSubtraction(CombinedExpression):
1051:    def _resolve_output_field(self):
1233:    def _resolve_output_field(self):
```


- subagent:spec-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":280,"limit":80}
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
…[2769 more chars]
```


- subagent:spec-probe → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":425,"limit":115}
```
  - ↩ result:
```text
425	class CombinedExpression(SQLiteNumericMixin, Expression):
426	
427	    def __init__(self, lhs, connector, rhs, output_field=None):
428	        super().__init__(output_field=output_field)
429	        self.connector = connector
430	        self.lhs = lhs
431	        self.rhs = rhs
432	
433	    def __repr__(self):
434	        return "<{}: {}>".format(self.__class__.__name__, self)
435	
436	    def __str__(self):
437	        return "{} {} {}".format(self.lhs, self.connector, self.rhs)
438	
439	    def get_source_expressions(self):
440	        return [self.lhs, self.rhs]
441	
442	    def set_source_expressions(self, exprs):
443	        self.lhs, self.rhs = exprs
444	
445	    def as_sql(self, 
…[4060 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"ExpressionWrapper","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/docs","output_mode":"content","-n":true,"-C":4,"head_limit":60}
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


- subagent:spec-probe → `Grep` ```json
{"pattern":"DurationField|timedelta","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/docs/ref/models/expressions.txt","output_mode":"content","-n":true,"-C":6}
```
  - ↩ result:
```text
558-~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
559-
560-There are times when a single column must be returned from a ``Subquery``, for
561-instance, to use a ``Subquery`` as the target of an ``__in`` lookup. To return
562-all comments for posts published within the last day::
563-
564:    >>> from datetime import timedelta
565-    >>> from django.utils import timezone
566:    >>> one_day_ago = timezone.now() - timedelta(days=1)
567-    >>> posts = Post.objects.filter(published_at__gte=one_day_ago)
568-    >>> Comment.objects.filter(post__in=Subquery(posts.values('pk')))
569-
570-In this case, the subquery must use :meth:`~.QuerySet.values`
571-to return only a single column: the primary key of t
…[642 more chars]
```


#### judge/main → dispatch `test-probe` (Assess test scoping)
```text
Assess the "false_negative" axis (0-3) for this benchmark candidate. Repo: django/django at commit 2d67222472f80f251607ae1b720527afceba06ad (version 3.2). The solver sees ONLY the issue text and repo, never the tests or gold patch.

## Issue text
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
--- a/django/db/
…[5692 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"completion_duration|ExpressionWrapper\\(F\\('completed'\\)|test_date_subtraction|test_time_subtraction","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true,"-C":8,"head_limit":80}
```
  - ↩ result:
```text
1486-
1487-    def test_duration_expressions(self):
1488-        for delta in self.deltas:
1489-            qs = Experiment.objects.annotate(duration=F('estimated_time') + delta)
1490-            for obj in qs:
1491-                self.assertEqual(obj.duration, obj.estimated_time + delta)
1492-
1493-    @skipUnlessDBFeature('supports_temporal_subtraction')
1494:    def test_date_subtraction(self):
1495-        queryset = Experiment.objects.annotate(
1496:            completion_duration=ExpressionWrapper(
1497-                F('completed') - F('assigned'), output_field=DurationField()
1498-            )
1499-        )
1500-
1501:        at_least_5_days = {e.name for e in queryset.filter(com
…[1558 more chars]
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
{"pattern":"test_date_subtraction|test_time_subtraction|test_datetime_subtraction|test_date_case_subtraction|subquery_subtraction","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true}
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
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","offset":1480,"limit":160}
```
  - ↩ result:
```text
1480	
1481	        queryset = Experiment.objects.annotate(shifted=ExpressionWrapper(
1482	            F('start') + Value(None, output_field=DurationField()),
1483	            output_field=DateTimeField(),
1484	        ))
1485	        self.assertIsNone(queryset.first().shifted)
1486	
1487	    def test_duration_expressions(self):
1488	        for delta in self.deltas:
1489	            qs = Experiment.objects.annotate(duration=F('estimated_time') + delta)
1490	            for obj in qs:
1491	                self.assertEqual(obj.duration, obj.estimated_time + delta)
1492	
1493	    @skipUnlessDBFeature('supports_temporal_subtraction')
1494	    def test_date_subtraction(self):
1495	        queryse
…[5324 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"microseconds|delta=","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true,"-C":10,"head_limit":50}
```
  - ↩ result:
```text
1289-
1290-class FTimeDeltaTests(TestCase):
1291-
1292-    @classmethod
1293-    def setUpTestData(cls):
1294-        cls.sday = sday = datetime.date(2010, 6, 25)
1295-        cls.stime = stime = datetime.datetime(2010, 6, 25, 12, 15, 30, 747000)
1296-        midnight = datetime.time(0)
1297-
1298-        delta0 = datetime.timedelta(0)
1299:        delta1 = datetime.timedelta(microseconds=253000)
1300-        delta2 = datetime.timedelta(seconds=44)
1301-        delta3 = datetime.timedelta(hours=21, minutes=8)
1302-        delta4 = datetime.timedelta(days=10)
1303-        delta5 = datetime.timedelta(days=90)
1304-
1305-        # Test data is set so that deltas and delays will be
1306-        
…[1485 more chars]
```


- subagent:spec-probe → `Grep` ```json
{"pattern":"def test_datetime_subtraction_microseconds","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","output_mode":"content","-n":true,"-A":14}
```
  - ↩ result:
```text
1621:    def test_datetime_subtraction_microseconds(self):
1622-        delta = datetime.timedelta(microseconds=8999999999999999)
1623-        Experiment.objects.update(end=F('start') + delta)
1624-        qs = Experiment.objects.annotate(
1625-            delta=ExpressionWrapper(F('end') - F('start'), output_field=DurationField())
1626-        )
1627-        for e in qs:
1628-            self.assertEqual(e.delta, delta)
1629-
1630-    def test_duration_with_datetime(self):
1631-        # Exclude e1 which has very high precision so we can test this on all
1632-        # backends regardless of whether or not it supports
1633-        # microsecond_precision.
1634-        over_estimate = Experi
…[104 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"def resolve_expression","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/query.py","output_mode":"content","-n":true,"-A":10}
```
  - ↩ result:
```text
1341:    def resolve_expression(self, *args, **kwargs):
1342-        if self._fields and len(self._fields) > 1:
1343-            # values() queryset can only be used as nested queries
1344-            # if they are set up to select only a single field.
1345-            raise TypeError('Cannot use multi-field values as a filter value.')
1346-        query = self.query.resolve_expression(*args, **kwargs)
1347-        query._db = self._db
1348-        return query
1349-    resolve_expression.queryset_only = True
1350-
1351-    def _add_hints(self, **hints):
```


- subagent:test-probe → `Grep` ```json
{"pattern":"output_field|def resolve_expression|class Query\\b","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/sql/query.py","output_mode":"content","-n":true,"head_limit":40}
```
  - ↩ result:
```text
136:class Query(BaseExpression):
233:    def output_field(self):
238:            return next(iter(self.annotation_select.values())).output_field
1024:    def resolve_expression(self, query, *args, **kwargs):
1193:            output_field = lhs.output_field.__class__
1194:            suggested_lookups = difflib.get_close_matches(name, output_field.get_lookups())
1201:                "permitted%s" % (name, output_field.__name__, suggestion)
1451:                    field = self.annotation_select[name].output_field
1838:        self.values_select += col.output_field.name,
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
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/sql/query.py","offset":1020,"limit":30}
```
  - ↩ result:
```text
1020	                                                   summarize=is_summary)
1021	        self.append_annotation_mask([alias])
1022	        self.annotations[alias] = annotation
1023	
1024	    def resolve_expression(self, query, *args, **kwargs):
1025	        clone = self.clone()
1026	        # Subqueries need to use a different set of aliases than the outer query.
1027	        clone.bump_prefix(query)
1028	        clone.subquery = True
1029	        # It's safe to drop ordering if the queryset isn't using slicing,
1030	        # distinct(*fields) or select_for_update().
1031	        if (self.low_mark == 0 and self.high_mark is None and
1032	                not self.distinct_fields and
1033	 
…[941 more chars]
```

  - ↩ result (subagent report):
```text
**Score:** 1 — The title states the goal unambiguously ("make temporal subtraction work without `ExpressionWrapper`") and the code makes the mechanism obvious, but the reproduction snippet reports a *different* symptom (mixed `DateTimeField`/`DurationField` in the outer `+`) than what the tests actually require (bare `F('end') - F('start')` inferring `DurationField`), leaving a small blank about the intended scope.

**Evidence:**
- The issue gives only a snippet and a traceback; the expected behaviour is stated only in the title. `issue`: `"make temporal subtraction work without ExpressionWrapper ... django.core.exceptions.FieldError: Expression contains mixed types: DateTimeField, DurationField. You must set output_field."`
- The codebase already contains both special-case expression classes needed, so "where the fix goes" is discoverable: the dispatch exists but only at SQL-compile time, i.e. after `output_field` inference has already failed. `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py:L454-L462`: `if (\n            not connection.features.has_native_duration_field and\n            'DurationField' in {lhs_type, rhs_type} and\n            lhs_type != rhs_type\n        ):\n            return DurationExpression(self.lhs, self.connector, self.rhs).as_sql(compiler, connection)` … `if self.connector == self.SUB and lhs_type in datetime_fields and lhs_type == rhs_type:\n            return TemporalSubtraction(self.lhs, self.rhs).as_sql(compiler, connection)`
- `TemporalSubtraction` already declares the target output type, so "temporal subtraction should be a `DurationField`" is resolved by the repo, not left open. `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py:L512-L516`: `class TemporalSubtraction(CombinedExpression):\n    output_field = fields.DurationField()`
- The failure mode in the issue traces to the generic inference helper, which a solver can read to see why `DateTimeField - DateTimeField` currently infers `DateTimeField`. `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py:L301-L312`: `for output_field in sources_iter:\n            for source in sources_iter:\n                if not isinstance(output_field, source.__class__):\n                    raise FieldError(\n                        'Expression contains mixed types: %s, %s. You must '\n                        'set output_field.'`
- Existing tests establish the exact "before" idiom that the fix is meant to render unnecessary, matching the issue title. `/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py:L1621-L1626`: `def test_datetime_subtraction_microseconds(self):` … `qs = Experiment.objects.annotate(\n            delta=ExpressionWrapper(F('end') - F('start'), output_field=DurationField())\n        )`
- The literal reproduction admits a narrower, wrong r
…[1467 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"def _annotate","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/query.py","output_mode":"content","-n":true,"-A":45}
```
  - ↩ result:
```text
No matches found
```


- subagent:test-probe → `Grep` ```json
{"pattern":"def annotate","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/query.py","output_mode":"content","-n":true,"-A":45}
```
  - ↩ result:
```text
1082:    def annotate(self, *args, **kwargs):
1083-        """
1084-        Return a query set in which the returned objects have been annotated
1085-        with extra data or aggregations.
1086-        """
1087-        self._not_support_combined_queries('annotate')
1088-        self._validate_values_are_expressions(args + tuple(kwargs.values()), method_name='annotate')
1089-        annotations = {}
1090-        for arg in args:
1091-            # The default_alias property may raise a TypeError.
1092-            try:
1093-                if arg.default_alias in kwargs:
1094-                    raise ValueError("The named annotation '%s' conflicts with the "
1095-                           
…[1537 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"mixed types|You must set output_field","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests","output_mode":"content","-n":true}
```
  - ↩ result:
```text
tests/aggregation/tests.py:896:            'Expression contains mixed types: FloatField, IntegerField. '
tests/aggregation/tests.py:897:            'You must set output_field.'
```


- subagent:test-probe → `Grep` ```json
{"pattern":"TemporalSubtraction|DurationExpression","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo","output_mode":"content","-n":true}
```
  - ↩ result:
```text
django/db/models/expressions.py:459:            return DurationExpression(self.lhs, self.connector, self.rhs).as_sql(compiler, connection)
django/db/models/expressions.py:462:            return TemporalSubtraction(self.lhs, self.rhs).as_sql(compiler, connection)
django/db/models/expressions.py:484:class DurationExpression(CombinedExpression):
django/db/models/expressions.py:512:class TemporalSubtraction(CombinedExpression):
```


- subagent:test-probe → `Grep` ```json
{"pattern":"supports_temporal_subtraction|has_native_duration_field","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/backends","output_mode":"content","-n":true}
```
  - ↩ result:
```text
django/db/backends/base/operations.py:633:        if self.connection.features.supports_temporal_subtraction:
django/db/backends/sqlite3/features.py:28:    supports_temporal_subtraction = True
django/db/backends/base/features.py:69:    has_native_duration_field = False
django/db/backends/base/features.py:73:    supports_temporal_subtraction = False
django/db/backends/oracle/features.py:17:    has_native_duration_field = True
django/db/backends/oracle/features.py:33:    supports_temporal_subtraction = True
django/db/backends/postgresql/features.py:14:    has_native_duration_field = True
django/db/backends/postgresql/features.py:34:    supports_temporal_subtraction = True
django/db/backends/mys
…[58 more chars]
```


- subagent:test-probe → `Grep` ```json
{"pattern":"def resolve_ref","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/sql/query.py","output_mode":"content","-n":true,"-A":22}
```
  - ↩ result:
```text
1662:    def resolve_ref(self, name, allow_joins=True, reuse=None, summarize=False):
1663-        if not allow_joins and LOOKUP_SEP in name:
1664-            raise FieldError("Joined field references are not permitted in this query")
1665-        annotation = self.annotations.get(name)
1666-        if annotation is not None:
1667-            if not allow_joins:
1668-                for alias in self._gen_col_aliases([annotation]):
1669-                    if isinstance(self.alias_map[alias], Join):
1670-                        raise FieldError(
1671-                            'Joined field references are not permitted in '
1672-                            'this query'
1673-                 
…[687 more chars]
```

  - ↩ result (subagent report):
```text
## Assessment

**Score:** 1 — The tests are purely behavioral (ORM query results, no gold-patch class/attribute names), so the main alternative fix (inferring `DurationField` in `CombinedExpression._resolve_output_field` instead of dispatching at resolve time) passes; the only residual risk is that the tests generalize past the issue's `DateTimeField` example to `DateField`/`TimeField`/subquery/`Case` operands.

**Evidence:**

- The new assertions test only observable ORM behavior — annotation values, `filter()` on the annotation, `assertIsNone` — never the gold patch's mechanism. No test anywhere references the classes the gold patch re-dispatches to (`/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py:L459-L522`, grep of `tests/` returns zero hits for `TemporalSubtraction|DurationExpression`); the only test-visible contract is "the subtraction's output_field is DurationField and the SQL still uses temporal subtraction".
- The alternative fix (override `_resolve_output_field` on `CombinedExpression`, leave `as_sql` dispatch alone) is sufficient because the existing `as_sql` dispatch already produces correct SQL for all tested shapes — that is exactly why the *pre-fix* versions of these tests pass today with an explicit `ExpressionWrapper`. `expressions.py:L445-L462`: `if self.connector == self.SUB and lhs_type in datetime_fields and lhs_type == rhs_type: return TemporalSubtraction(self.lhs, self.rhs).as_sql(compiler, connection)`. So only output-field inference is missing; a solver fixing just that passes all 7 FAIL_TO_PASS tests.
- The subquery cases do not require gold's resolve-time dispatch: `output_field` is a lazily-computed `cached_property`, and by the time it is accessed the lhs is a resolved `Query`, which exposes a working `output_field` (`django/db/models/sql/query.py:L232-L238`): `def output_field(self): if len(self.select) == 1: select = self.select[0]; return getattr(select, 'target', None) or select.field`.
- The `Case` case likewise needs no special handling in an alternative fix, because `resolve_ref` returns the annotation object itself, which carries the declared `output_field` (`django/db/models/sql/query.py:L1662-L1681`): `annotation = self.annotations.get(name) ... else: return annotation`.
- Tests go beyond the issue's literal example: the issue only shows `DateTimeField` (`issue`: "Experiment.objects.annotate(\n\tdelta=F('end') - F('start') + Value(datetime.timedelta(), output_field=DurationField())\n)"), while FAIL_TO_PASS includes `test_date_subtraction`, `test_time_subtraction`, `test_date_case_subtraction` and three subquery tests. A fix scoped to `DateTimeField` only would fail — but the pre-existing code already treats the three types as one set (`expressions.py:L460`): `datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}`, so generalizing is the natural reading, not a gold-only choice.
- Conversely, the issue's exact expression (`... + Value(timede
…[1540 more chars]
```


**judge/main:** Now let me spot-check the key claims both probes rest on.

- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":285,"limit":30}
```
  - ↩ result:
```text
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
295	        supply their own output_field with more complex computations.
296	
297	        If a source's output field resolves to None, exclude it from this check.
298	        If all sources are None, then an erro
…[765 more chars]
```


- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":440,"limit":85}
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
…[3013 more chars]
```


**judge/main:** Both probes' load-bearing claims check out. Verified directly:

- `expressions.py:L445-462` — the SQL-level dispatch to `DurationExpression`/`TemporalSubtraction` already exists pre-fix, so correct SQL was never the missing piece; only output-field *inference* is.
- `expressions.py:L513` — `TemporalSubtraction.output_field = fields.DurationField()` already declares the target type, so "temporal subtraction → DurationField" is settled by the repo, not left open by the issue.
- `expressions.py:L305-L311` — `_resolve_output_field` is the exact source of the issue's `FieldError` message.

This confirms an alternative fix (overriding `_resolve_output_field`/`output_field` on `CombinedExpression` rather than relocating dispatch into `resolve_expression`) would satisfy the behavioral assertions, and the tests reference no gold-patch-only names.

#### judge/main → **final verdict**
```json
{
  "underspecified": 1,
  "underspecified_rationale": "The title states the goal unambiguously (\"make temporal subtraction work without ExpressionWrapper\") and the repo makes the mechanism discoverable: django/db/models/expressions.py:L445-462 already dispatches to TemporalSubtraction/DurationExpression at as_sql time, and TemporalSubtraction declares output_field = DurationField() (L513), while _resolve_output_field (L301-312) raises the exact FieldError quoted in the issue because inference happens before that dispatch. The blank to fill: the reproduction snippet shows the symptom on the outer `+ Value(timedelta(...))`, so a solver could narrowly read it as \"allow DateTimeField ± DurationField mixing\" rather than \"bare F('end') - F('start') should infer DurationField\" — but the title plus the existing ExpressionWrapper idiom in tests make the intended reading clearly dominant.",
  "false_negative": 1,
  "false_negative_rationale": "The rewritten FTimeDeltaTests assert only observable ORM behavior — annotation values (assertEqual(e.delta, delta)), filtering on the annotation (.filter(difference=datetime.timedelta()) / assertTrue(exists())) and assertIsNone for NULL operands. No assertion references TemporalSubtraction, DurationExpression, resolve_expression, has_native_duration_field or any name introduced by the gold patch; grep of tests/ finds no hits for those classes. Because the SQL-level dispatch at expressions.py:L445-462 already produces correct temporal SQL (which is why the pre-patch tests passed with an explicit ExpressionWrapper), the natural alternative fix — teaching CombinedExpression._resolve_output_field to return DurationField for datetime SUB — passes all seven FAIL_TO_PASS tests, including the subquery cases (Query.output_field resolves the inner select) and the Case case (resolve_ref returns the annotation with its declared output_field). Residual risk is only that the tests generalize past the issue's DateTimeField example to DateField/TimeField/subquery/Case; a solver scoping the fix to DateTimeField alone would fail. That is mitigated by the pre-existing datetime_fields = {'DateField', 'DateTimeField', 'TimeField'} set at L460, which makes generalizing the obvious reading.",
  "evidence": [
    {
      "axis": "underspecified",
      "source": "issue",
      "ref": "issue",
      "claim": "The issue body only shows a traceback for the outer DateTimeField+DurationField mix; the actual required behavior (bare temporal subtraction inferring DurationField) is stated only in the title, admitting a narrower wrong reading.",
      "quote": "make temporal subtraction work without ExpressionWrapper ... django.core.exceptions.FieldError: Expression contains mixed types: DateTimeField, DurationField. You must set output_field."
    },
    {
      "axis": "underspecified",
      "source": "repo",
      "ref": "django/db/models/expressions.py:L460-L462",
      "claim": "The dispatch to TemporalSubtraction already exists but only at SQL-compile time, after output_field inference has failed, making the location of the fix discoverable.",
      "quote": "datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}\n        if self.connector == self.SUB and lhs_type in datetime_fields and lhs_type == rhs_type:\n            return TemporalSubtraction(self.lhs, self.rhs).as_sql(compiler, connection)"
    },
    {
      "axis": "false_negative",
      "source": "repo",
      "ref": "django/db/models/expressions.py:L512-L513",
      "claim": "TemporalSubtraction already declares DurationField output, so an alternative fix that only changes output-field inference (not the resolve-time dispatch) yields the same observable behavior the tests assert.",
      "quote": "class TemporalSubtraction(CombinedExpression):\n    output_field = fields.DurationField()"
    },
    {
      "axis": "false_negative",
      "source": "test_patch",
      "ref": "tests/expressions/tests.py",
      "claim": "Tests exercise DateField, TimeField, subquery and Case operands, going beyond the issue's DateTimeField-only example, so a fix scoped to DateTimeField would fail.",
      "quote": "difference=F('time') - Value(datetime.time(11, 15, 0), output_field=TimeField()),"
    }
  ],
  "decision": "usable",
  "confidence": 4
}
```


## Result
- subtype: success · turns: 6 · 270s · cost $1.210 · tokens in/out/cache: 6/7486/39992

### ✅ Verification passed