/** Adversarial tests for run isolation: the run lock and screening attempt ids. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireRunLock, attemptId } from "./lib/run.ts";
import { trajectoryPath } from "./lib/paths.ts";

test("a second runner on the same run directory is refused while the first is alive", () => {
  const dir = mkdtempSync(join(tmpdir(), "ft-run-"));
  const release = acquireRunLock(dir);
  assert.throws(() => acquireRunLock(dir, process.pid + 1), /already being executed/);
  release();
  assert.ok(!existsSync(join(dir, "run.lock")));
});

test("a lock left by a dead process is taken over, and release only removes a lock this process owns", () => {
  const dir = mkdtempSync(join(tmpdir(), "ft-run-"));
  writeFileSync(join(dir, "run.lock"), "999999999"); // no such pid
  const release = acquireRunLock(dir);
  assert.equal(readFileSync(join(dir, "run.lock"), "utf8"), String(process.pid));
  writeFileSync(join(dir, "run.lock"), "12345"); // someone else took it
  release();
  assert.ok(existsSync(join(dir, "run.lock")), "a lock owned by another process is not removed");
});

test("concurrent screenings of the same instance never share a trajectory path", () => {
  const ids = new Set(Array.from({ length: 50 }, () => attemptId()));
  assert.equal(ids.size, 50);
  const [a, b] = [...ids];
  assert.notEqual(trajectoryPath(`screen-x-${a}`, "x"), trajectoryPath(`screen-x-${b}`, "x"));
});
