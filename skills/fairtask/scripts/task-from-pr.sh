#!/usr/bin/env bash
# Build a fairtask task JSON from a GitHub pull request.
#   scripts/task-from-pr.sh <owner/repo> <pr-number> > task.json
# Fields: repo, base_commit (the PR's base sha), problem_statement (the linked issue's title+body, else the PR
# title+body), patch (non-test files), test_patch (test files), FAIL_TO_PASS (added test functions, best effort —
# verify by running them if you can). Requires: gh (authenticated for private repos), jq, python3.
set -euo pipefail
repo="${1:?owner/repo}"; num="${2:?pr number}"
meta=$(gh pr view "$num" --repo "$repo" --json baseRefOid,title,body,number,closingIssuesReferences)
base=$(jq -r .baseRefOid <<<"$meta")
issue_num=$(jq -r '.closingIssuesReferences[0].number // empty' <<<"$meta")
if [ -n "$issue_num" ]; then
  issue=$(gh issue view "$issue_num" --repo "$repo" --json title,body)
  statement=$(jq -r '"\(.title)\n\n\(.body // "")"' <<<"$issue")
else
  statement=$(jq -r '"\(.title)\n\n\(.body // "")"' <<<"$meta")
fi
diff=$(gh pr diff "$num" --repo "$repo")
python3 - "$repo" "$base" "$num" "$statement" "$diff" <<'PY'
import json, re, sys
repo, base, num, statement, diff = sys.argv[1:6]
files = re.split(r'(?m)^(?=diff --git )', diff)
is_test = lambda path: bool(re.search(r'(^|/)(tests?|testing)(/|_)|(^|/)test_[^/]*\.py$|_test\.[a-z]+$|\.spec\.[jt]sx?$|\.test\.[jt]sx?$', path))
patch, test_patch, f2p = [], [], []
for chunk in files:
    m = re.match(r'diff --git a/(\S+) b/(\S+)', chunk)
    if not m: continue
    path = m.group(2)
    (test_patch if is_test(path) else patch).append(chunk)
    if is_test(path):
        for t in re.findall(r'(?m)^\+\s*(?:async\s+)?def\s+(test_[A-Za-z0-9_]+)', chunk): f2p.append(f"{path}::{t}")
        for t in re.findall(r'(?m)^\+\s*(?:it|test)\(\s*[\'"]([^\'"]+)[\'"]', chunk): f2p.append(f"{path}::{t}")
print(json.dumps({
  "instance_id": f"{repo.replace('/', '__')}-{num}", "repo": repo, "base_commit": base,
  "problem_statement": statement.strip(), "patch": "".join(patch), "test_patch": "".join(test_patch),
  "FAIL_TO_PASS": f2p, "_note": "FAIL_TO_PASS lists added test functions (best effort); confirm by running them before trusting a verdict on the test axis."
}, indent=2))
PY
