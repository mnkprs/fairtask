# Trajectory — django__django-13128 — baseline (baseline-rerun)
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

- **session** `68447b6a-5953-424e-a92b-1e5d4fd4cf2c` · tools: StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup

#### judge/main → **final verdict**
```json
{
  "claim": "placeholder",
  "underspecified": 1,
  "underspecified_rationale": "The issue is a terse Django ticket, but the title (\"make temporal subtraction work without ExpressionWrapper\") plus the reproducer and the exact FieldError make the requirement clear: `F('end') - F('start')` between two temporal fields must automatically resolve to a DurationField-typed expression (currently the dispatch to `TemporalSubtraction`/`DurationExpression` only happens in `CombinedExpression.as_sql`, so `output_field` resolution fails earlier with \"Expression contains mixed types\"). An engineer must infer that the fix should generalize to DateField/TimeField and to Duration+temporal combinations, which the ticket does not state explicitly, but the existing code in django/db/models/expressions.py (`datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}`) makes the intended scope obvious. Minor blank: no mention of subquery/Case operands, though those follow naturally from a general fix.",
  "false_negative": 1,
  "false_negative_rationale": "The hidden tests only remove the `ExpressionWrapper(..., output_field=DurationField())` wrappers from existing assertions (e.g. `completion_duration=F('completed') - F('assigned')`, `difference=subquery - F('start')`, `qs.annotate(delta=F('end') - F('start'))`) and keep the same value/filter assertions (`assertEqual(less_than_5_days, {'e0','e1','e2'})`, `assertIsNone(queryset.first().difference)`, `assertEqual(e.delta, delta)`). They do not reference any new API, parameter, class or error message introduced by the gold patch, so alternative implementations (e.g. teaching `CombinedExpression._resolve_output_field` that temporal-minus-temporal yields DurationField, or wrapping at resolve time) also pass. Slight risk: the tests extend beyond the DateTimeField case in the issue to DateField, TimeField, subquery and Case operands, so a fix narrowly targeting only DateTimeField would fail test_date_subtraction/test_time_subtraction — hence 1 rather than 0.",
  "evidence": [
    {
      "axis": "underspecified",
      "claim": "The issue gives only a reproducer and error message; the required behaviour (auto DurationField output for temporal subtraction) must be inferred from the title.",
      "source": "issue",
      "ref": "issue",
      "quote": "make temporal subtraction work without ExpressionWrapper ... django.core.exceptions.FieldError: Expression contains mixed types: DateTimeField, DurationField. You must set output_field."
    },
    {
      "axis": "false_negative",
      "claim": "Tests broaden the issue's DateTimeField example to DateField, TimeField, subquery and Case operands, which the issue never mentions.",
      "source": "test_patch",
      "ref": "tests/expressions/tests.py",
      "quote": "difference=F('time') - Value(datetime.time(11, 15, 0), output_field=TimeField()),"
    }
  ],
  "decision": "usable",
  "confidence": 4
}
```

  - ⚠️ schema rejected: Output does not match required schema: root: must NOT have additional properties

#### judge/main → **final verdict**
```json
{
  "underspecified": 1,
  "underspecified_rationale": "The issue is a terse Django ticket, but the title (\"make temporal subtraction work without ExpressionWrapper\") plus the reproducer and the exact FieldError make the requirement clear: `F('end') - F('start')` between two temporal fields must resolve to a DurationField-typed expression. Currently the dispatch to `TemporalSubtraction`/`DurationExpression` happens only in `CombinedExpression.as_sql` (django/db/models/expressions.py), so output_field resolution fails earlier with \"Expression contains mixed types\". Minor blanks: the ticket doesn't mention DateField/TimeField, subquery or Case operands, though the existing `datetime_fields = {'DateField', 'DateTimeField', 'TimeField'}` set in the same file makes the intended scope obvious.",
  "false_negative": 1,
  "false_negative_rationale": "The hidden tests only strip the `ExpressionWrapper(..., output_field=DurationField())` wrappers from existing assertions (e.g. `completion_duration=F('completed') - F('assigned')`, `difference=subquery - F('start')`, `annotate(delta=F('end') - F('start'))`) while keeping the same value/filter assertions (`assertEqual(less_than_5_days, {'e0','e1','e2'})`, `assertIsNone(queryset.first().difference)`, `assertEqual(e.delta, delta)`). No new API, parameter, class name or error message from the gold patch is referenced, so alternative implementations (e.g. handling temporal-minus-temporal in `CombinedExpression._resolve_output_field`) also pass. Slight risk: the tests cover DateField, TimeField, subquery and Case operands beyond the issue's DateTimeField example, so a narrowly scoped fix could fail test_date_subtraction/test_time_subtraction.",
  "evidence": [
    {
      "axis": "underspecified",
      "claim": "The issue gives only a reproducer and error message; the required behaviour (temporal subtraction auto-resolving to DurationField) must be inferred from the title.",
      "source": "issue",
      "ref": "issue",
      "quote": "make temporal subtraction work without ExpressionWrapper ... django.core.exceptions.FieldError: Expression contains mixed types: DateTimeField, DurationField. You must set output_field."
    },
    {
      "axis": "false_negative",
      "claim": "Tests broaden the issue's DateTimeField example to TimeField/DateField/subquery/Case operands, which the issue never mentions.",
      "source": "test_patch",
      "ref": "tests/expressions/tests.py",
      "quote": "difference=F('time') - Value(datetime.time(11, 15, 0), output_field=TimeField()),"
    },
    {
      "axis": "false_negative",
      "claim": "Assertions are unchanged behavioural checks with no dependence on gold-patch-specific names, so multiple reasonable fixes pass.",
      "source": "test_patch",
      "ref": "tests/expressions/tests.py",
      "quote": "qs = Experiment.objects.annotate(delta=F('end') - F('start'))\n        for e in qs:\n            self.assertEqual(e.delta, delta)"
    }
  ],
  "decision": "usable",
  "confidence": 4
}
```


## Result
- subtype: success · turns: 3 · 53s · cost $0.155 · tokens in/out/cache: 4/4468/12742

### ✅ Verification passed