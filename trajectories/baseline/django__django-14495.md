# Trajectory — django__django-14495 — baseline (baseline)
Model: `claude-opus-5` · stratum: **underspecified** · human labels: underspecified=2, false_negative=1, filter_out=true

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
# Candidate task: django__django-14495
Repository: django/django @ cbba49971bbbbe3e8c6685e4ce6ab87b1187ae87 (version 4.0)

## Issue text (this is ALL the solver will see)
<issue>
KeyError when trying to migrate backward to a replaced migration
Description
	
Django exhibits some internal confusion regarding whether replaced migrations exist or not. Consider this simple app with two migrations and squashed migration replacing both:
$ ls testproj/migrations/
0001_initial.py 0001_squashed_0002_thing_age.py 0002_thing_age.py __init__.py
When it comes to disambiguating input, Django seems to believe that the replaced migrations still need to be considered:
$ ./manage.py migrate testproj 0001
CommandError: More than one migration matches '0001' in app 'testproj'. Please be more specific.
But if you actually try to disambiguate and specify one of the replaced migrations, Django no longer thinks it exists (and isn't very graceful about telling you so):
$ ./manage.py migrate testproj 0001_initial
Traceback (most recent call last):
 File "./manage.py", line 10, in <module>
	execute_from_command_line(sys.argv)
 File "/home/carljm/projects/django/django/django/django/core/management/__init__.py", line 330, in execute_from_command_line
	utility.execute()
 File "/home/carljm/projects/django/django/django/django/core/management/__init__.py", line 322, in execute
	self.fetch_command(subcommand).run_from_argv(self.argv)
 File "/home/carljm/projects/django/django/django/django/core/management/base.py", line 347, in run_from_argv
	self.execute(*args, **cmd_options)
 File "/home/carljm/projects/django/django/django/django/core/management/base.py", line 398, in execute
	output = self.handle(*args, **options)
 File "/home/carljm/projects/django/django/django/django/core/management/commands/migrate.py", line 135, in handle
	plan = executor.migration_plan(targets)
 File "/home/carljm/projects/django/django/django/django/db/migrations/executor.py", line 50, in migration_plan
	self.loader.graph.node_map[target].children
KeyError: ('testproj', '0001_initial')
There could be several different approaches to fixing this, but my feeling is that Django shouldn't prevent you from migrating to a replaced migration. If a migration still exists on disk, even if it's been squashed and you've fully migrated the squashed set, you should be able to migrate back to a state within the squashed set. It seems like there might be production rollback cases where that could be important, and I don't see in principle why it shouldn't be possible.
If that turns out to be impractical, then I think Django oughtn't bother you about resolving ambiguities with migration names it won't let you migrate to anyway. And the "nonexistent" error for this case should be nicer than a raw KeyError. (In Django 1.7 the error was "ValueError: Node ('testproj17', '0001_initial') not a valid node", which is perhaps a bit better, but not much.)
</issue>

## Gold patch (the original PR's code change — the solver does
…[5946 more chars]
```

## Execution

- **session** `4450e8cc-35ba-477d-9a80-e2c941c68c6e` · tools: StructuredOutput · subagents: claude, Explore, general-purpose, Plan, statusline-setup

#### judge/main → **final verdict**
```json
{
  "confidence": 4,
  "decision": "usable",
  "underspecified": 1,
  "underspecified_rationale": "The issue clearly describes the bug (KeyError in MigrationExecutor.migration_plan when the target is a replaced/squashed-away migration) with a full traceback pointing at django/db/migrations/executor.py, and states the reporter's preferred fix: \"Django shouldn't prevent you from migrating to a replaced migration ... you should be able to migrate back to a state within the squashed set.\" The only ambiguity is the fallback suggestion (\"If that turns out to be impractical, then ... oughtn't bother you about resolving ambiguities ... and the 'nonexistent' error ... should be nicer\"), which leaves a small chance a solver implements the nicer-error path instead of the permissive path. The primary requested behavior is nevertheless unambiguous, and the repo already exposes MigrationLoader(replace_migrations=...) making the permissive path clearly practical.",
  "false_negative": 1,
  "false_negative_rationale": "Both FAIL_TO_PASS tests are purely behavioural: they migrate forward to '0001_squashed_0002', then call migrate/executor.migrate to ('migrations', '0001_initial') and assert assertTableExists('migrations_author') / assertTableNotExists('migrations_book'). No new public API, parameter or error message from the gold patch is asserted, so any implementation that lets you roll back to a replaced migration (rebuilding the graph without replacements, instantiating a fresh loader with replace_migrations=False, etc.) will pass. The only implementation coupling is the test patch adding self.replace_migrations = True to tests/migrations/test_executor.FakeLoader and the test_loader assertions on loader.replace_migrations, but those belong to non-FAIL_TO_PASS tests and the attribute already exists on the real MigrationLoader in this commit. The residual risk is that a solver picks the issue's secondary suggestion (raise a nicer error instead of allowing the rollback), which would fail these tests.",
  "evidence": [
    {
      "axis": "underspecified",
      "claim": "The issue offers an alternative, lesser fix (nicer error instead of allowing the migration), which a solver could implement and then fail the tests.",
      "quote": "If that turns out to be impractical, then I think Django oughtn't bother you about resolving ambiguities with migration names it won't let you migrate to anyway. And the \"nonexistent\" error for this case should be nicer than a raw KeyError.",
      "ref": "issue",
      "source": "issue"
    },
    {
      "axis": "false_negative",
      "claim": "The FAIL_TO_PASS tests assert only observable schema/behaviour, not gold-patch internals.",
      "quote": "executor.migrate([('migrations', '0001_initial')])\n            self.assertTableExists('migrations_author')\n            self.assertTableNotExists('migrations_book')",
      "ref": "tests/migrations/test_executor.py",
      "source": "test_patch"
    }
  ]
}
```


## Result
- subtype: success · turns: 2 · 34s · cost $0.112 · tokens in/out/cache: 2/2835/1932

### ✅ Verification passed