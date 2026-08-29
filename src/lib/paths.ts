export const ROOT = new URL("../../", import.meta.url).pathname;
/** Identifiers that become path segments (instance ids, run ids) must be plain slugs: no slashes, no dot-dot, no leading dot. */
export const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;
export function assertSlug(kind: string, value: string): string {
  if (!SLUG.test(value) || value.includes("..")) throw new Error(`${kind} "${value}" is not a valid identifier (letters, digits, ".", "_", "-" only; no path separators)`);
  return value;
}
export const workspaceDir = (instanceId: string) => `${ROOT}workspaces/${assertSlug("instance_id", instanceId)}/repo`;
export const resultsDir = (runId: string) => `${ROOT}results/${assertSlug("run_id", runId)}`;
export const trajectoryPath = (runId: string, instanceId: string) => `${ROOT}trajectories/${assertSlug("run_id", runId)}/${assertSlug("instance_id", instanceId)}.jsonl`;
