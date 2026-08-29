#!/usr/bin/env python3
"""Regenerate the generated tables in README.md and REPRODUCE.md from results/*/summary.json.
Usage: scripts/finalize-report.py <final-run-id> <run-id> [<run-id> ...]"""
import json, re, subprocess, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
final, runs = sys.argv[1], sys.argv[2:]
final_repeat = next((r for r in runs if r == f"{final.split('-')[0]}-rerun"), None)
subprocess.run(["node", "src/score.ts", *runs], cwd=root, check=True, capture_output=True)
report = subprocess.run(["node", "src/report.ts", "--baseline", "baseline", "--final", final, *(["--final-repeat", final_repeat] if final_repeat else []), "--markdown", "--runs", ",".join(runs)], cwd=root, check=True, capture_output=True, text=True).stdout.strip()
readme = (root / "README.md").read_text()
start = readme.index("### Headline comparison"); end = readme.index("*How to read this.*")
readme = readme[:start] + report + "\n\n" + readme[end:]
(root / "README.md").write_text(readme)
rows = []
for run in runs:
    s = json.loads((root / "results" / run / "summary.json").read_text())
    rows.append(f"| `{run}` | {s['n']} | {s['mean_duration_s']:.0f} s | ${s['mean_cost_usd']:.2f} | ${s['total_cost_usd']:.0f} | ~{max(1, round(s['n'] * s['mean_duration_s'] / 3 / 60))} min at concurrency 3 |")
table = "| Run | Cases | Mean time / case | Mean cost / case | Total cost (list) | Wall-clock for the set |\n|---|---|---|---|---|---|\n" + "\n".join(rows)
rep = (root / "REPRODUCE.md").read_text()
rep = re.sub(r"\| Run \| Cases \|.*?(?=\n\nMeasured on)", table, rep, flags=re.S)
(root / "REPRODUCE.md").write_text(rep)
print(f"README results section and REPRODUCE cost table regenerated for {len(runs)} runs (final = {final})")
