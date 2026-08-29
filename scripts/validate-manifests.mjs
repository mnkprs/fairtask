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
const skill = readFileSync("skills/fairtask/SKILL.md", "utf8");
const fm = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
if (!/^name: fairtask$/m.test(fm)) fail("SKILL.md: frontmatter name must be fairtask");
if (!/^description: .{40,}/m.test(fm)) fail("SKILL.md: description missing or too short");
if (/\$\d/.test(skill)) fail("SKILL.md: contains $<digit> which the skill loader substitutes with invocation words");
if (!/--branch v\d+\.\d+\.\d+/.test(skill)) fail("SKILL.md: engine install must pin a release tag");
const pkg = read("package.json");
if (pkg.version !== claude.version) fail(`package.json version ${pkg.version} differs from plugin version ${claude.version}`);
if (!process.exitCode) console.log(`manifests ok: fairtask ${claude.version}, skill frontmatter ok, capabilities disclosed`);
