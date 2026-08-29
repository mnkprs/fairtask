import { existsSync, mkdirSync, rmSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { TaskInstance } from "./types.ts";
import { ROOT, workspaceDir } from "./paths.ts";
import { resolve, sep } from "node:path";

const exec = promisify(execFile);
async function git(cwd: string, ...a: string[]) {
  const { stdout } = await exec("git", a, { cwd, maxBuffer: 64 * 1024 * 1024 });
  return stdout.trim();
}

/** "owner/name", "github.com/owner/name" or a full URL → clone URL. */
export function repoUrl(repo: string): string {
  if (/^https?:\/\//.test(repo) || repo.startsWith("git@")) return repo.endsWith(".git") ? repo : `${repo}.git`;
  const m = repo.replace(/^github\.com\//, "").match(/^([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!m) throw new Error(`cannot parse repository "${repo}" (expected owner/name or a URL)`);
  return `https://github.com/${m[1]}/${m[2]}.git`;
}

/**
 * Shallow-clone the repository at the task's base commit into workspaces/<instance_id>/repo.
 * Idempotent: a workspace already at that commit is reused. Returns the workspace path.
 */
export async function prepareWorkspace(inst: TaskInstance): Promise<{ dir: string; status: "cached" | "cloned" }> {
  const dir = workspaceDir(inst.instance_id);
  if (!resolve(dir).startsWith(resolve(`${ROOT}workspaces`) + sep)) throw new Error("workspace path escapes the workspaces root");
  if (!/^[0-9a-f]{7,40}$/i.test(inst.base_commit)) throw new Error(`base_commit "${inst.base_commit}" is not a commit hash`);
  if (existsSync(`${dir}/.git`)) {
    try { if ((await git(dir, "rev-parse", "HEAD")) === inst.base_commit) return { dir, status: "cached" }; } catch { /* re-clone */ }
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
  await git(dir, "init", "-q");
  await git(dir, "remote", "add", "origin", repoUrl(inst.repo));
  await git(dir, "fetch", "-q", "--depth", "1", "origin", inst.base_commit);
  await git(dir, "checkout", "-q", "FETCH_HEAD");
  const head = await git(dir, "rev-parse", "HEAD");
  if (head !== inst.base_commit) throw new Error(`HEAD ${head} != base_commit ${inst.base_commit}`);
  return { dir, status: "cloned" };
}
