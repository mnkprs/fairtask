export const ROOT = new URL("../../", import.meta.url).pathname;
export const workspaceDir = (instanceId: string) => `${ROOT}workspaces/${instanceId}/repo`;
export const resultsDir = (runId: string) => `${ROOT}results/${runId}`;
export const trajectoryPath = (runId: string, instanceId: string) => `${ROOT}trajectories/${runId}/${instanceId}.jsonl`;
