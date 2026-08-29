/**
 * Render a JSONL trajectory as readable Markdown: instructions → tool calls → tool results → retries → verdict.
 *
 * Usage: node src/trajectory-view.ts trajectories/<run>/<instance>.jsonl [--full]   (writes .md next to it and prints it)
 */
import { readFileSync, writeFileSync } from "node:fs";

const [path, ...flags] = process.argv.slice(2);
if (!path) { console.error("usage: node src/trajectory-view.ts <trajectory.jsonl> [--full]"); process.exit(2); }
const full = flags.includes("--full");
const events = readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, any>);
const clip = (s: string, n: number) => (full || s.length <= n ? s : `${s.slice(0, n)}\n…[${s.length - n} more chars]`);
const fence = (s: string, lang = "") => `\n\`\`\`${lang}\n${s.replace(/```/g, "'''")}\n\`\`\`\n`;

const out: string[] = [];
const start = events.find((e) => e.event === "start")!;
const agentNames = new Map<string, string>([["main", "judge/main"]]);
const toolNameById = new Map<string, string>();
out.push(`# Trajectory — ${start.instance_id} — ${start.variant} (${start.run_id})`);
out.push(`Model: \`${start.model}\` · stratum: **${start.stratum}** · human labels: underspecified=${start.human.underspecified}, false_negative=${start.human.false_negative}, filter_out=${start.human.filter_out}\n`);
out.push(`## Agent instructions\n### Main agent system prompt${fence(clip(start.system_prompt ?? "(default)", 2500), "text")}`);
if (start.agents) for (const [name, a] of Object.entries<any>(start.agents)) out.push(`### Subagent \`${name}\` (tools: ${(a.tools ?? []).join(", ")})${fence(clip(a.prompt, 2500), "text")}`);
out.push(`### Task prompt${fence(clip(start.prompt, 3000), "text")}`);
out.push(`## Execution\n`);
for (const e of events) {
  const who = (id: string) => agentNames.get(id) ?? `subagent@${id.slice(-6)}`;
  switch (e.event) {
    case "init": out.push(`- **session** \`${e.session_id}\` · tools: ${(e.tools ?? []).join(", ")} · subagents: ${(e.agents ?? []).join(", ") || "none"}`); break;
    case "thinking": out.push(`\n> _[${who(e.agent)} thinking]_ ${clip(e.text, 600).replace(/\n/g, " ")}`); break;
    case "assistant_text": out.push(`\n**${who(e.agent)}:** ${clip(e.text, 1500)}`); break;
    case "tool_use": {
      toolNameById.set(e.id, e.tool);
      if (e.tool === "Agent") { agentNames.set(e.id, `subagent:${e.input?.subagent_type ?? "?"}`); out.push(`\n#### ${who(e.agent)} → dispatch \`${e.input?.subagent_type}\` (${e.input?.description ?? ""})${fence(clip(String(e.input?.prompt ?? ""), 800), "text")}`); }
      else if (e.tool === "StructuredOutput") out.push(`\n#### ${who(e.agent)} → **final verdict**${fence(JSON.stringify(e.input, null, 2), "json")}`);
      else out.push(`\n- ${who(e.agent)} → \`${e.tool}\` ${fence(JSON.stringify(e.input), "json").trim()}`);
      break;
    }
    case "tool_result": {
      const t = toolNameById.get(e.tool_use_id);
      if (t === "StructuredOutput") { if (e.is_error) out.push(`  - ⚠️ schema rejected: ${clip(e.content, 300)}`); break; }
      out.push(`  - ${e.is_error ? "❌ error" : "↩ result"}${t === "Agent" ? " (subagent report)" : ""}:${fence(clip(e.content, t === "Agent" ? 3000 : 700), "text")}`);
      break;
    }
    case "verification_failed": out.push(`\n### ⛔ Verification failed (attempt ${e.attempt})\n${e.problems.map((p: string) => `- ${p}`).join("\n")}`); break;
    case "retry_prompt": out.push(`\n**feedback sent to agent:**${fence(clip(e.text, 1200), "text")}`); break;
    case "verification_final": out.push(`\n### ${e.passed ? "✅ Verification passed" : "⚠️ Verification not passed"}${e.problems?.length ? `\n${e.problems.map((p: string) => `- ${p}`).join("\n")}` : ""}`); break;
    case "result": out.push(`\n## Result\n- subtype: ${e.subtype} · turns: ${e.num_turns} · ${(e.duration_ms / 1000).toFixed(0)}s · cost $${Number(e.total_cost_usd).toFixed(3)} · tokens in/out/cache: ${e.usage.input}/${e.usage.output}/${e.usage.cache_read}`); break;
    case "exception": out.push(`\n## ❌ Exception\n${e.message}`); break;
    default: break;
  }
}
const md = out.join("\n");
const target = path.replace(/\.jsonl$/, ".md");
writeFileSync(target, md);
console.log(md);
console.error(`\n(wrote ${target})`);
