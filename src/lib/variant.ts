import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { TaskInstance, Verdict } from "./types.ts";

export interface RunContext {
  model: string;
  workspace: string; // absolute path of the repo checkout
}

/** A system under evaluation: how to build its query, and (optionally) how to verify its answer. */
export interface Variant {
  name: string;
  description: string;
  build(inst: TaskInstance, ctx: RunContext): { prompt: string; options: Options };
  /**
   * Return a list of problems with the verdict. Non-empty => the runner resumes the session with
   * the problems as feedback and asks for a corrected verdict (up to maxRetries).
   */
  validate?(verdict: Verdict, inst: TaskInstance, ctx: RunContext): string[];
  maxRetries?: number;
}
