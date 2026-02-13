#!/usr/bin/env bash
set -euo pipefail

echo "[init] Starting harness initialization..."

required_files=(
  "app_spec.md"
  "feature_list.json"
  "feature_list.schema.json"
  "harness/orchestrator.yaml"
  "harness/policies/agent_policy.json"
  "claude-progress.txt"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "[init] Missing required file: $file" >&2
    exit 1
  fi
done

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "$timestamp | init | Initialization script completed successfully." >> claude-progress.txt

echo "[init] Initialization completed."

