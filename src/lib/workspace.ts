import { existsSync, lstatSync, mkdirSync, realpathSync, renameSync, rmSync } from "node:fs";
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

/**
 * "owner/name", "github.com/owner/name" or a full URL → clone URL. Credentials embedded in a URL (user:token@host) are
 * refused: they would be written into prompts, trajectories and verdicts. Use a git credential helper instead.
 */
export function repoUrl(repo: string): string {
  if (repo.startsWith("file://")) return repo; // local mirrors (offline use, tests)
  if (/^https?:\/\//.test(repo) || repo.startsWith("git@")) {
    if (/^https?:\/\/[^/]*@/.test(repo) || /[?#]/.test(repo)) throw new Error("repository URLs must not carry credentials or query strings; configure a git credential helper for private repositories");
    return repo.endsWith(".git") ? repo : `${repo}.git`;
  }
  const m = repo.replace(/^github\.com\//, "").match(/^([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!m) throw new Error(`cannot parse repository "${repo}" (expected owner/name or a URL)`);
  return `https://github.com/${m[1]}/${m[2]}.git`;
}

/**
 * Shallow-clone the repository at the task's base commit into workspaces/<instance_id>/repo.
 * Idempotent: a workspace already at that commit is reused. Returns the workspace path.
 */
/** True when every existing component of `p` under `root` is a real directory (no symlinks that could redirect git). */
function noSymlinkComponents(root: string, p: string): boolean {
  const parts = resolve(p).slice(resolve(root).length).split(sep).filter(Boolean);
  let cur = resolve(root);
  for (const part of parts) { cur = `${cur}${sep}${part}`; if (!existsSync(cur)) break; if (lstatSync(cur).isSymbolicLink()) return false; }
  return true;
}

/** A cached checkout is trusted only if it is at the base commit, clean, and points at the expected remote. */
async function trustedCheckout(dir: string, inst: TaskInstance): Promise<boolean> {
  try {
    if ((await git(dir, "rev-parse", "HEAD")) !== inst.base_commit) return false;
    if ((await git(dir, "status", "--porcelain", "--untracked-files=all")) !== "") return false;
    if ((await git(dir, "remote", "get-url", "origin")) !== repoUrl(inst.repo)) return false;
    return true;
  } catch { return false; }
}

export async function prepareWorkspace(inst: TaskInstance): Promise<{ dir: string; status: "cached" | "cloned" }> {
  const root = `${ROOT}workspaces`;
  const dir = workspaceDir(inst.instance_id);
  if (!resolve(dir).startsWith(resolve(root) + sep)) throw new Error("workspace path escapes the workspaces root");
  if (!/^[0-9a-f]{7,40}$/i.test(inst.base_commit)) throw new Error(`base_commit "${inst.base_commit}" is not a commit hash`);
  const url = repoUrl(inst.repo); // validates the URL before anything touches the disk
  mkdirSync(root, { recursive: true });
  if (!noSymlinkComponents(root, dir)) throw new Error(`workspace path for ${inst.instance_id} contains a symlink; refusing to use it`);
  if (existsSync(dir) && realpathSync(dir) !== resolve(dir)) throw new Error(`workspace for ${inst.instance_id} resolves outside its path; refusing to use it`);
  if (existsSync(`${dir}/.git`) && (await trustedCheckout(dir, inst))) return { dir, status: "cached" };
  // Clone into a fresh sibling directory, verify, then swap it in atomically; a stale or dirty checkout is replaced whole.
  const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  await git(tmp, "init", "-q");
  await git(tmp, "remote", "add", "origin", url);
  await git(tmp, "fetch", "-q", "--depth", "1", "origin", inst.base_commit);
  await git(tmp, "checkout", "-q", "FETCH_HEAD");
  const head = await git(tmp, "rev-parse", "HEAD");
  if (head !== inst.base_commit) { rmSync(tmp, { recursive: true, force: true }); throw new Error(`HEAD ${head} != base_commit ${inst.base_commit}`); }
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(resolve(dir, ".."), { recursive: true });
  renameSync(tmp, dir);
  return { dir, status: "cloned" };
}
