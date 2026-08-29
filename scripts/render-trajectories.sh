#!/usr/bin/env bash
# Render every JSONL trajectory of a run to Markdown: scripts/render-trajectories.sh <run-id>
set -euo pipefail
cd "$(dirname "$0")/.."
run="${1:?usage: $0 <run-id>}"
for f in trajectories/"$run"/*.jsonl; do node src/trajectory-view.ts "$f" >/dev/null 2>&1; done
ls trajectories/"$run"/*.md | wc -l | xargs -I{} echo "rendered {} trajectories for $run"
