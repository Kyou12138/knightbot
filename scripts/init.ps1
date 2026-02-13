Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "[init] Starting harness initialization..."

$requiredDirs = @(
    "harness",
    "harness/agent_prompts",
    "harness/policies",
    "scripts"
)

foreach ($dir in $requiredDirs) {
    if (-not (Test-Path -Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
        Write-Host "[init] Created directory: $dir"
    }
}

$requiredFiles = @(
    "app_spec.md",
    "feature_list.json",
    "feature_list.schema.json",
    "harness/orchestrator.yaml",
    "harness/policies/agent_policy.json",
    "claude-progress.txt"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path -Path $file)) {
        throw "[init] Missing required file: $file"
    }
}

$timestamp = (Get-Date).ToUniversalTime().ToString("s") + "Z"
Add-Content -Path "claude-progress.txt" -Value "$timestamp | init | Initialization script completed successfully."

Write-Host "[init] Initialization completed."

