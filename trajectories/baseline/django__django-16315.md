# Trajectory — django__django-16315 — baseline (baseline)
Model: `claude-opus-5` · stratum: **clean** · human labels: underspecified=0, false_negative=0, filter_out=false

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
# Candidate task: django__django-16315
Repository: django/django @ 7d5329852f19c6ae78c6f6f3d3e41835377bf295 (version 4.2)

## Issue text (this is ALL the solver will see)
<issue>
QuerySet.bulk_create() crashes on mixed case columns in unique_fields/update_fields.
Description
	
Not sure exactly how to phrase this, but when I I'm calling bulk_update on the manager for a class with db_column set on fields the SQL is invalid. Ellipses indicate other fields excluded for clarity.
class ActivityBlackListed(models.Model):
	"""
	Originally sourced from Activity_BlackListed in /home/josh/PNDS_Interim_MIS-Data.accdb (13 records)
	"""
	class Meta:
		db_table = "Activity_BlackListed"
	blacklistid = models.IntegerField(primary_key=True, db_column="BlacklistID")
	sectorid = models.IntegerField(null=True, blank=True, db_column="SectorID")
	...
qs.bulk_create(instances, update_conflicts=True, update_fields=["sectorid", ...], unique_fields=["blacklistid"])
The "INSERT" code does take into account the db_columns
INSERT INTO "Activity_BlackListed" ("BlacklistID",...) VALUES (%s, ...),
The code which is generated for "ON CONFLICT" uses the field name and not the db_column which leads to a syntax error
'ON CONFLICT("blacklistid") DO UPDATE SET "sectorid" = EXCLUDED."sectorid", ...
PostgreSQL returns ERROR: column "blacklistid" does not exist at character 1508
What should be generated is I think:
'ON CONFLICT("BlacklistID") DO UPDATE SET "SectorID" = EXCLUDED."SectorID", ...
</issue>

## Gold patch (the original PR's code change — the solver does NOT see this)
<gold_patch>
diff --git a/django/db/models/query.py b/django/db/models/query.py
--- a/django/db/models/query.py
+++ b/django/db/models/query.py
@@ -720,7 +720,6 @@ def _check_bulk_create_options(
                     "Unique fields that can trigger the upsert must be provided."
                 )
             # Updating primary keys and non-concrete fields is forbidden.
-            update_fields = [self.model._meta.get_field(name) for name in update_fields]
             if any(not f.concrete or f.many_to_many for f in update_fields):
                 raise ValueError(
                     "bulk_create() can only be used with concrete fields in "
@@ -732,9 +731,6 @@ def _check_bulk_create_options(
                     "update_fields."
                 )
             if unique_fields:
-                unique_fields = [
-                    self.model._meta.get_field(name) for name in unique_fields
-                ]
                 if any(not f.concrete or f.many_to_many for f in unique_fields):
                     raise ValueError(
                         "bulk_create() can only be used with concrete fields "
@@ -786,8 +782,11 @@ def bulk_create(
         if unique_fields:
             # Primary key is allowed in unique_fields.
             unique_fields = [
-                opts.pk.name if name == "pk" else name for name in unique_fields
+                self.model._meta.get_field(opts.pk.name if name == "pk"
…[3425 more chars]
```

## Execution

- **session** `7d746512-405b-4388-a08d-ae0d6a24b7da` · tools: StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup

#### judge/main → **final verdict**
```json
{
  "decision": "usable",
  "underspecified": 0,
  "underspecified_rationale": "The issue precisely describes the bug: `bulk_create(update_conflicts=True, ...)` generates the `ON CONFLICT (...) DO UPDATE SET ...` clause using Python field names rather than the fields' `db_column` values, producing invalid SQL on PostgreSQL. It shows both the broken SQL and the expected SQL ('ON CONFLICT(\"BlacklistID\") DO UPDATE SET \"SectorID\" = EXCLUDED.\"SectorID\"'). The only minor noise is the sentence saying \"calling bulk_update\", contradicted immediately by the code sample `qs.bulk_create(...)` and the title, so the intent is unambiguous. An engineer can locate `SQLInsertCompiler.as_sql` in django/db/models/sql/compiler.py passing `self.query.update_fields`/`unique_fields` into `on_conflict_suffix_sql`, plus `QuerySet._check_bulk_create_options` in django/db/models/query.py, and fix the name→column translation.",
  "false_negative": 0,
  "false_negative_rationale": "The single FAIL_TO_PASS test, test_update_conflicts_unique_fields_update_fields_db_column, is purely behavioral: it defines FieldsWithDbColumns with db_column=\"rAnK\"/\"oTheRNaMe\", performs bulk_create with update_conflicts=True, unique_fields=[\"rank\"], update_fields=[\"name\"], and asserts the row count and resulting values via assertCountEqual on values(\"rank\", \"name\"). It does not depend on any new helper name, signature, or error message introduced by the gold patch (which converts names to field objects and passes `f.column` generators). Any implementation that resolves field names to db columns — whether inside the compiler, in the query attributes, or in backend on_conflict_suffix_sql — will pass, so all reasonable fixes are accepted.",
  "evidence": [],
  "confidence": 5
}
```


## Result
- subtype: success · turns: 2 · 16s · cost $0.064 · tokens in/out/cache: 2/1219/1932

### ✅ Verification passed