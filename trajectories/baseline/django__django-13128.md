# Trajectory — django__django-13128 — baseline (baseline)
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

Answer with a JSON verdict matching the required schema.
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
…[7436 more chars]
```

## Execution

- **session** `390cf4c2-fc92-4d02-b5b9-5499dcc19419` · tools: StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup

#### judge/main → **final verdict**
```json
{
  "confidence": 4,
  "decision": "usable",
  "underspecified": 1,
  "underspecified_rationale": "The issue body is terse (a model, one queryset, one traceback line), but the title \"make temporal subtraction work without ExpressionWrapper\" plus the FieldError makes the requirement clear: `F('end') - F('start')` between two temporal fields must resolve to a DurationField output on its own, so no ExpressionWrapper(output_field=DurationField()) is needed and it can be further combined with a DurationField Value. The existing code in django/db/models/expressions.py already contains the dispatch logic in CombinedExpression.as_sql (to TemporalSubtraction / DurationExpression) but it happens too late, after output_field resolution fails, so an experienced engineer can locate the fix. Minor blanks: the issue only mentions DateTimeField, leaving the engineer to infer that DateField/TimeField and subquery/Case operands must be handled too, and it does not state whether the result should be exposed as DurationField in filters.",
  "false_negative": 1,
  "false_negative_rationale": "The test patch only deletes ExpressionWrapper(..., output_field=DurationField()) wrappers and keeps the same behavioural assertions (e.g. `assertEqual(less_than_5_days, {'e0','e1','e2'})`, `assertIsNone(queryset.first().difference)`, `.filter(difference=datetime.timedelta())` + `assertTrue(queryset.exists())`, `assertEqual(e.delta, delta)`). No new function, kwarg, class name or error message introduced by the gold patch is referenced, so any implementation that makes temporal subtraction resolve to DurationField (e.g. overriding `_resolve_output_field` on CombinedExpression instead of moving the dispatch into `resolve_expression`) passes. The only risk is a narrow reading of the issue: a solver who only makes DateTimeField+DurationField combination legal (returning DateTimeField) would satisfy the pasted snippet but fail tests such as test_time_subquery_subtraction and test_date_case_subtraction, which additionally cover TimeField, Subquery and Case operands never mentioned in the issue.",
  "evidence": [
    {
      "axis": "underspecified",
      "claim": "The issue only demonstrates DateTimeField subtraction, while the hidden tests also require DateField, TimeField, Subquery and Case operands to work unwrapped.",
      "quote": "class Experiment(models.Model):\n\tstart = models.DateTimeField()\n\tend = models.DateTimeField()",
      "ref": "issue",
      "source": "issue"
    },
    {
      "axis": "false_negative",
      "claim": "Tests assert only observable query behaviour after removing ExpressionWrapper, not any gold-patch-specific API.",
      "quote": "queryset = Experiment.objects.annotate(\n            completion_duration=F('completed') - F('assigned'),\n        )",
      "ref": "tests/expressions/tests.py",
      "source": "test_patch"
    },
    {
      "axis": "false_negative",
      "claim": "Tests extend beyond the issue example to Case/When and Subquery temporal subtraction.",
      "quote": "difference=F('date_case') - F('completed_value'),\n        ).filter(difference=datetime.timedelta())",
      "ref": "tests/expressions/tests.py",
      "source": "test_patch"
    }
  ]
}
```


## Result
- subtype: success · turns: 2 · 38s · cost $0.127 · tokens in/out/cache: 2/3093/1932

### ✅ Verification passed