import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const MAX_RESULT_CHARS = 6000;
const clip = (s: string, n = MAX_RESULT_CHARS) => (s.length > n ? `${s.slice(0, n)}\n…[truncated ${s.length - n} chars]` : s);

/**
 * Writes a compact, human-readable JSONL trajectory: one line per event.
 * Subagent activity is attributed via `parent_tool_use_id` (the Agent tool call that spawned it).
 */
export class TrajectoryWriter {
  private seq = 0;
  private readonly path: string;
  constructor(path: string, header: Record<string, unknown>) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "");
    this.emit({ event: "start", ...header });
  }

  private emit(e: Record<string, unknown>) {
    appendFileSync(this.path, `${JSON.stringify({ seq: this.seq++, ts: new Date().toISOString(), ...e })}\n`);
  }

  note(event: string, data: Record<string, unknown> = {}) { this.emit({ event, ...data }); }

  record(m: SDKMessage) {
    switch (m.type) {
      case "assistant": {
        for (const b of m.message.content) {
          if (b.type === "text") this.emit({ event: "assistant_text", agent: m.parent_tool_use_id ?? "main", text: b.text });
          else if (b.type === "tool_use") this.emit({ event: "tool_use", agent: m.parent_tool_use_id ?? "main", id: b.id, tool: b.name, input: b.input });
          else if (b.type === "thinking" && b.thinking) this.emit({ event: "thinking", agent: m.parent_tool_use_id ?? "main", text: clip(b.thinking, 2000) });
        }
        break;
      }
      case "user": {
        const content = m.message.content;
        if (typeof content === "string") { if (!m.isSynthetic) this.emit({ event: "user_text", text: clip(content) }); break; }
        for (const b of content) {
          if (b.type === "tool_result") {
            const text = typeof b.content === "string" ? b.content
              : (b.content ?? []).map((c) => (c.type === "text" ? c.text : `[${c.type}]`)).join("\n");
            this.emit({ event: "tool_result", agent: m.parent_tool_use_id ?? "main", tool_use_id: b.tool_use_id, is_error: b.is_error ?? false, content: clip(text) });
          } else if (b.type === "text" && !m.isSynthetic) this.emit({ event: "user_text", text: clip(b.text) });
        }
        break;
      }
      case "result": {
        this.emit({ event: "result", subtype: m.subtype, num_turns: m.num_turns, duration_ms: m.duration_ms, total_cost_usd: m.total_cost_usd,
          usage: { input: m.usage.input_tokens, output: m.usage.output_tokens, cache_read: m.usage.cache_read_input_tokens, cache_create: m.usage.cache_creation_input_tokens },
          structured_output: m.subtype === "success" ? m.structured_output : undefined, session_id: m.session_id });
        break;
      }
      case "system": {
        if (m.subtype === "init") this.emit({ event: "init", model: m.model, tools: m.tools, agents: m.agents, session_id: m.session_id, permissionMode: m.permissionMode });
        break;
      }
      default: break;
    }
  }
}
