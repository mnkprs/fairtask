#!/usr/bin/env bash
# Build a fairtask task JSON from a GitHub pull request.
#   scripts/task-from-pr.sh <owner/repo> <pr-number> [--lenient] > task.json
# Fails closed (exit 3, no JSON) when the task cannot be trusted: no linked issue (the PR body is not the issue),
# no test files in the diff, or no FAIL_TO_PASS selector that can be confirmed against the added tests. `--lenient`
# emits the task anyway with "_status": "unconfirmed", which `npm run screen` refuses unless --allow-unconfirmed.
# Fields: repo, base_commit (the PR's base sha), problem_statement (the linked issue's title+body — from whichever
# repository the issue lives in — else the PR title+body), patch (non-test files), test_patch (test files),
# FAIL_TO_PASS (test functions ADDED by the PR, best effort: modified existing tests are not detected and class
# methods are emitted as path::Class::method only when the class can be seen in the diff). Confirm FAIL_TO_PASS by
# running the tests before trusting a verdict on the test axis.
# Bulk data is passed through temporary files, never argv. Requires: gh (authenticated for private repos), jq, python3.
set -euo pipefail
repo="${1:?owner/repo}"; num="${2:?pr number}"; lenient="${3:-}"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
gh pr view "$num" --repo "$repo" --json baseRefOid,title,body,number,closingIssuesReferences,files > "$tmp/pr.json"
issue_repo=$(jq -r '.closingIssuesReferences[0].repository.nameWithOwner // empty' "$tmp/pr.json")
issue_num=$(jq -r '.closingIssuesReferences[0].number // empty' "$tmp/pr.json")
if [ -n "$issue_num" ]; then
  gh issue view "$issue_num" --repo "${issue_repo:-$repo}" --json title,body | jq -r '"\(.title)\n\n\(.body // "")"' > "$tmp/statement.txt"
else
  jq -r '"\(.title)\n\n\(.body // "")"' "$tmp/pr.json" > "$tmp/statement.txt"
fi
gh pr diff "$num" --repo "$repo" > "$tmp/pr.diff"
[ -n "$issue_num" ] && echo "issue" > "$tmp/source" || echo "pr-body" > "$tmp/source"
python3 - "$repo" "$num" "$tmp" "$lenient" <<'PY'
import json, re, sys
repo, num, tmp, lenient = sys.argv[1:5]
source = open(f"{tmp}/source").read().strip()
meta = json.load(open(f"{tmp}/pr.json"))
statement = open(f"{tmp}/statement.txt").read()
diff = open(f"{tmp}/pr.diff").read()
# File list from GitHub's structured metadata (handles quoted/odd names); split the diff by those paths.
paths = [f["path"] for f in meta.get("files", [])]
is_test = lambda p: bool(re.search(r'(^|/)(tests?|testing|__tests__|spec)(/|_)|(^|/)test_[^/]*\.py$|_test\.[a-z]+$|\.(spec|test)\.[jt]sx?$', p))
chunks = re.split(r'(?m)^(?=diff --git )', diff)
def chunk_path(c):
    m = re.match(r'diff --git "?a/(.+?)"? "?b/(.+?)"?\n', c)
    return m.group(2) if m else None
patch, test_patch, f2p = [], [], []
for c in chunks:
    p = chunk_path(c)
    if not p: continue
    (test_patch if is_test(p) else patch).append(c)
    if is_test(p):
        cls = None
        for line in c.split("\n"):
            m = re.match(r'^[+ ]?\s*class\s+([A-Za-z_][A-Za-z0-9_]*)', line)
            if m: cls = m.group(1)
            m = re.match(r'^\+\s*(?:async\s+)?def\s+(test_[A-Za-z0-9_]+)', line)
            if m:
                indented = line.startswith("+ ") or line.startswith("+\t")
                f2p.append(f"{p}::{cls}::{m.group(1)}" if (indented and cls) else f"{p}::{m.group(1)}")
        for t in re.findall(r'(?m)^\+\s*(?:it|test)\(\s*[\'"]([^\'"]+)[\'"]', c): f2p.append(f"{p}::{t}")
missing = sorted(set(paths) - {chunk_path(c) for c in chunks if chunk_path(c)})
# Confirm every selector against the test functions the diff actually adds (name after the last "::", without params).
added_defs = set(re.findall(r'(?m)^\+\s*(?:async\s+)?def\s+(test_[A-Za-z0-9_]+)', "".join(test_patch)))
confirmed = [t for t in f2p if t.split("::")[-1].split("[")[0] in added_defs]
problems = []
if source != "issue": problems.append("no linked issue: the PR body is not the issue text the solver would see")
if not test_patch: problems.append("no test files in the diff: the test axis cannot be screened")
if not confirmed: problems.append("no FAIL_TO_PASS selector could be confirmed against the tests the PR adds")
if problems and lenient != "--lenient":
    sys.stderr.write("task-from-pr: refusing to emit an unconfirmed task:\n  - " + "\n  - ".join(problems) + "\nRe-run with --lenient to emit it anyway (marked _status: unconfirmed).\n")
    sys.exit(3)
out = {
  "instance_id": f"{repo.replace('/', '__')}-{num}", "repo": repo, "base_commit": meta["baseRefOid"],
  "problem_statement": statement.strip(), "patch": "".join(patch), "test_patch": "".join(test_patch),
  "FAIL_TO_PASS": confirmed,
  "_status": "unconfirmed" if problems else "confirmed",
  "_note": "FAIL_TO_PASS lists test functions ADDED by the PR, confirmed against the test diff (modified existing tests are not detected). Run them before trusting a verdict on the test axis.",
}
if problems: out["_problems"] = problems
if missing: out["_warning"] = f"{len(missing)} file(s) in the PR could not be matched in the diff text: {missing[:5]}"
if not test_patch: out["_warning"] = (out.get("_warning", "") + " No test files detected — the test axis cannot be screened.").strip()
print(json.dumps(out, indent=2))
PY
