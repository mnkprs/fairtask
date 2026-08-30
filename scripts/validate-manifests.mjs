#!/usr/bin/env node
// Semantic validation of the plugin manifests (rules the marketplace validators enforce but do not document well):
// version present and semver; skills/commands/hooks are arrays; marketplace plugins carry name/source/version; the
// Codex manifest names an existing skills dir and declares its capabilities; the skill named by every manifest exists.
import { readFileSync, existsSync } from "node:fs";
const fail = (m) => { console.error(`manifest: ${m}`); process.exitCode = 1; };
const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const semver = /^\d+\.\d+\.\d+$/;
const claude = read(".claude-plugin/plugin.json");
if (!semver.test(claude.version ?? "")) fail("claude plugin.json: version must be semver");
for (const k of ["skills", "commands", "hooks"]) if (k in claude && !Array.isArray(claude[k])) fail(`claude plugin.json: ${k} must be an array`);
for (const dir of claude.skills ?? []) if (!existsSync(dir)) fail(`claude plugin.json: skills dir ${dir} missing`);
const market = read(".claude-plugin/marketplace.json");
if (!Array.isArray(market.plugins) || market.plugins.length === 0) fail("marketplace.json: plugins must be a non-empty array");
for (const p of market.plugins ?? []) { for (const k of ["name", "source", "version"]) if (!p[k]) fail(`marketplace.json: plugin missing ${k}`); if (p.version && p.version !== claude.version) fail("marketplace.json: version differs from plugin.json"); }
const codex = read(".codex-plugin/plugin.json");
if (!semver.test(codex.version ?? "")) fail("codex plugin.json: version must be semver");
if (codex.version !== claude.version) fail("codex plugin.json: version differs from claude plugin.json");
if (typeof codex.skills !== "string" || !existsSync(codex.skills)) fail("codex plugin.json: skills must point at an existing directory");
const caps = codex.interface?.capabilities ?? [];
for (const c of ["Read", "Write", "Network", "Execute"]) if (!caps.includes(c)) fail(`codex plugin.json: capabilities must disclose ${c} (the skill clones, installs and runs the engine)`);
for (const name of ["fairtask", "fairtask-baseline", "fairtask-report", "fairtask-score", "fairtask-cases", "fairtask-trajectory", "fairtask-eval"]) {
  const text = readFileSync(`skills/${name}/SKILL.md`, "utf8");
  const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  if (!new RegExp(`^name: ${name}$`, "m").test(front)) fail(`skills/${name}/SKILL.md: frontmatter name must be ${name}`);
  if (!/^description: .{40,}/m.test(front)) fail(`skills/${name}/SKILL.md: description missing or too short`);
  if (/\$\d/.test(text)) fail(`skills/${name}/SKILL.md: contains $<digit> which the skill loader substitutes with invocation words`);
}
const skill = readFileSync("skills/fairtask/SKILL.md", "utf8");
if (!/--branch v\d+\.\d+\.\d+/.test(skill)) fail("SKILL.md: engine install must pin a release tag");
const pkg = read("package.json");
if (pkg.version !== claude.version) fail(`package.json version ${pkg.version} differs from plugin version ${claude.version}`);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const [f, v] of [[".claude-plugin/plugin.json", claude.version], [".codex-plugin/plugin.json", codex.version], [".claude-plugin/marketplace.json", market.plugins[0]?.version]])
  if (v !== pkg.version) fail(`${f}: version ${v} != package.json ${pkg.version}`);
const pin = new RegExp(`--branch v${pkg.version.replace(/\./g, "\\.")}\\b`);
for (const f of ["skills/fairtask/SKILL.md", "skills/fairtask-baseline/SKILL.md"])
  if (!pin.test(readFileSync(f, "utf8"))) fail(`${f}: engine pin does not match version v${pkg.version}`);
if (!process.exitCode) console.log(`manifests ok: fairtask ${claude.version}, skill frontmatter ok, capabilities disclosed`);
