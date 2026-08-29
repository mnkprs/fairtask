# Trajectory — django__django-13128 — v1-context (v1-context)
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
…[7440 more chars]
```

## Execution

- **session** `77f82f35-b9b8-4d80-8e14-1da6cab7d057` · tools: Glob, Grep, Read, StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup

- judge/main → `Read` ```json
{"file_path":"/repo/django/db/models/expressions.py","offset":280,"limit":260}
```
  - ❌ error:
```text
File does not exist. Note: your current working directory is /Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo.
```


- judge/main → `Grep` ```json
{"pattern":"test_datetime_subtraction|test_date_subtraction|_resolve_output_field|mixed types","output_mode":"content","-n":true}
```
  - ↩ result:
```text
tests/aggregation/tests.py:896:            'Expression contains mixed types: FloatField, IntegerField. '
django/db/models/functions/window.py:47:    def _resolve_output_field(self):
django/db/models/functions/window.py:77:    def _resolve_output_field(self):
django/db/models/functions/mixins.py:44:    def _resolve_output_field(self):
django/db/models/functions/mixins.py:50:        return super()._resolve_output_field() if source_fields else FloatField()
django/db/models/expressions.py:269:        output_field = self._resolve_output_field()
django/db/models/expressions.py:279:        _resolve_output_field() didn't return an output type.
django/db/models/expressions.py:287:    def _resolve_out
…[505 more chars]
```


- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/expressions.py","offset":255,"limit":290}
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
…[5324 more chars]
```


- judge/main → `Grep` ```json
{"pattern":"def output_field|_output_field_or_none|def resolve_expression","path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/sql/query.py","output_mode":"content","-n":true}
```
  - ↩ result:
```text
233:    def output_field(self):
1024:    def resolve_expression(self, query, *args, **kwargs):
```


- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/tests/expressions/tests.py","offset":1470,"limit":160}
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


- judge/main → `Read` ```json
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


- judge/main → `Read` ```json
{"file_path":"/Users/manoskaparos/Projects/taskprobe/workspaces/django__django-13128/repo/django/db/models/sql/query.py","offset":1018,"limit":20}
```
  - ↩ result:
```text
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
1028	        clone.subquery = True
1029	        # It's safe to drop ordering if the queryset isn't using slicing,
1030	        # disti
…[450 more chars]
```


#### judge/main → **final verdict**
```json
{
  "underspecified": 1,
  "underspecified_rationale": "The issue gives a concrete, runnable repro (annotating `F('end') - F('start') + Value(timedelta(), output_field=DurationField())`) plus the exact exception raised (\"Expression contains mixed types: DateTimeField, DurationField\"), and the title states the goal: temporal subtraction should work without an ExpressionWrapper. The codebase makes the intended behaviour unambiguous: `CombinedExpression.as_sql` (django/db/models/expressions.py:445-462) already dispatches to `TemporalSubtraction` (output_field = DurationField) and `DurationExpression` at SQL-compilation time for `datetime_fields = {'DateField','DateTimeField','TimeField'}`; the only missing piece is that this dispatch happens too late for output_field inference, so a careful reader sees that the resolution has to move into `resolve_expression`/`_resolve_output_field`. What is left open is scope (only DateTimeField vs. all temporal fields, subqueries, Case expressions) and the interaction with backends having `has_native_duration_field`, but the existing constants and helper classes strongly guide those choices.",
  "false_negative": 1,
  "false_negative_rationale": "The test patch only removes `ExpressionWrapper(..., output_field=DurationField())` from existing temporal-subtraction tests and keeps every existing assertion (e.g. `at_least_5_days == {'e3','e4','e5'}`, `assertIsNone(queryset.first().difference)`, `assertEqual(e.delta, delta)`); it introduces no new API name, parameter, or message that the solver could not guess, so any fix that makes `F('completed') - F('assigned')` infer a DurationField passes. The main residual risk is scope beyond the issue's example: the tests also require `subquery - F('completed')` and `F('date_case') - F('completed_value')` to work unwrapped. A solver who implements the inference purely via `BaseExpression._resolve_output_field()`/`get_source_fields()` would hit `Query._output_field_or_none` (django/db/models/sql/query.py only defines an `output_field` property, line 232) and fail the three *_subquery_subtraction tests, whereas the gold patch resolves the operands first and catches AttributeError. That is an unusual-but-plausible variant, so risk is limited to level 1; the mainstream fix (moving the existing as_sql dispatch into resolve_expression) passes.",
  "evidence": [
    {
      "axis": "false_negative",
      "claim": "Tests require unwrapped subtraction where the left operand is a QuerySet/Query, a case not mentioned in the issue; resolved Query objects expose `output_field` but not `_output_field_or_none`, which `get_source_fields()` uses.",
      "source": "repo",
      "ref": "django/db/models/sql/query.py:L232-L238",
      "quote": "    @property\n    def output_field(self):\n        if len(self.select) == 1:\n            select = self.select[0]\n            return getattr(select, 'target', None) or select.field"
    },
    {
      "axis": "false_negative",
      "claim": "The test patch drops ExpressionWrapper for subquery-based subtraction, extending beyond the issue's F-F example.",
      "source": "test_patch",
      "ref": "tests/expressions/tests.py",
      "quote": "         queryset = Experiment.objects.annotate(\n-            difference=ExpressionWrapper(\n-                subquery - F('completed'), output_field=DurationField(),\n-            ),\n+            difference=subquery - F('completed'),\n         ).filter(difference=datetime.timedelta())"
    },
    {
      "axis": "underspecified",
      "claim": "The repository already contains the temporal-subtraction dispatch logic in as_sql, which tells a solver what the intended output type/behaviour is.",
      "source": "repo",
      "ref": "django/db/models/expressions.py:L460-L462",
      "quote": "        datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}\n        if self.connector == self.SUB and lhs_type in datetime_fields and lhs_type == rhs_type:\n            return TemporalSubtraction(self.lhs, self.rhs).as_sql(compiler, connection)"
    }
  ],
  "decision": "usable",
  "confidence": 4
}
```


## Result
- subtype: success · turns: 9 · 97s · cost $0.410 · tokens in/out/cache: 10/7851/58460

### ✅ Verification passed