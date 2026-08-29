/** Adversarial tests for workspace trust. Uses a local bare repository as the remote — no network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, existsSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareWorkspace, repoUrl } from "./lib/workspace.ts";
import { ROOT } from "./lib/paths.ts";

const git = (cwd: string, ...a: string[]) => execFileSync("git", a, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } }).trim();

// A tiny "upstream" repository with one commit, served over file://
const upstream = mkdtempSync(join(tmpdir(), "ft-upstream-"));
git(upstream, "init", "-q", "-b", "main");
writeFileSync(join(upstream, "a.py"), "x = 1\n");
git(upstream, "add", "."); git(upstream, "commit", "-q", "-m", "one");
const base = git(upstream, "rev-parse", "HEAD");
const id = `fairtask__test-${process.pid}`;
const task = { instance_id: id, repo: `file://${upstream}`, base_commit: base, problem_statement: "p", patch: "", test_patch: "", FAIL_TO_PASS: [] };
const wsRoot = join(ROOT, "workspaces");
const wsDir = join(wsRoot, id);
const cleanup = () => rmSync(wsDir, { recursive: true, force: true });

test("repoUrl refuses credentials and query strings", () => {
  assert.throws(() => repoUrl("https://user:token@github.com/o/r"), /credentials/);
  assert.throws(() => repoUrl("https://github.com/o/r?token=x"), /credentials|query/);
  assert.equal(repoUrl("o/r"), "https://github.com/o/r.git");
});

test("a fresh clone lands at the base commit and is reused only while trusted", async () => {
  cleanup();
  const first = await prepareWorkspace(task);
  assert.equal(first.status, "cloned"); assert.equal(git(first.dir, "rev-parse", "HEAD"), base);
  assert.equal((await prepareWorkspace(task)).status, "cached");
  // dirty tree → not trusted → re-cloned
  writeFileSync(join(first.dir, "junk.txt"), "tamper");
  assert.equal((await prepareWorkspace(task)).status, "cloned");
  assert.ok(!existsSync(join(first.dir, "junk.txt")));
  // wrong remote → re-cloned
  git(first.dir, "remote", "set-url", "origin", "https://github.com/someone/else.git");
  assert.equal((await prepareWorkspace(task)).status, "cloned");
  assert.equal(git(first.dir, "remote", "get-url", "origin"), task.repo);
  cleanup();
});

test("a symlink planted at the workspace path is refused, not followed", async () => {
  cleanup();
  const elsewhere = mkdtempSync(join(tmpdir(), "ft-elsewhere-"));
  mkdirSync(wsRoot, { recursive: true });
  symlinkSync(elsewhere, wsDir);
  await assert.rejects(prepareWorkspace(task), /symlink|outside/);
  assert.ok(!existsSync(join(elsewhere, "repo", ".git")), "nothing was cloned through the symlink");
  rmSync(wsDir, { force: true }); cleanup();
});

test("a bad base_commit is rejected before anything touches the disk", async () => {
  cleanup();
  await assert.rejects(prepareWorkspace({ ...task, base_commit: "main; rm -rf /" }), /not a commit hash/);
  assert.ok(!existsSync(wsDir));
});
