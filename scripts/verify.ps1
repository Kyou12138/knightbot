Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    Write-Host "[verify] FAIL: $Message"
    exit 1
}

Write-Host "[verify] Starting harness verification..."

$requiredFiles = @(
    "app_spec.md",
    "feature_list.json",
    "feature_list.schema.json",
    "harness/orchestrator.yaml",
    "harness/agent_prompts/initializer.md",
    "harness/agent_prompts/coding.md",
    "harness/agent_prompts/qa.md",
    "harness/policies/agent_policy.json",
    "claude-progress.txt"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path -Path $file)) {
        Fail "Missing required file: $file"
    }
}

$featureList = Get-Content -Raw "feature_list.json" | ConvertFrom-Json
if (-not $featureList.features) {
    Fail "feature_list.json has no features."
}

$ids = @{}
foreach ($feature in $featureList.features) {
    if ($ids.ContainsKey($feature.id)) {
        Fail "Duplicate feature id: $($feature.id)"
    }
    $ids[$feature.id] = $true

    if (-not $feature.acceptance_criteria -or $feature.acceptance_criteria.Count -lt 1) {
        Fail "Feature $($feature.id) has empty acceptance_criteria."
    }
    if ($null -eq $feature.status.passes) {
        Fail "Feature $($feature.id) missing status.passes."
    }
    if ($feature.status.passes -eq $true -and $feature.status.evidence.Count -lt 1) {
        Fail "Feature $($feature.id) marked passed without evidence."
    }
}

$timestamp = (Get-Date).ToUniversalTime().ToString("s") + "Z"
Add-Content -Path "claude-progress.txt" -Value "$timestamp | verify | Harness verification passed."
Write-Host "[verify] Verification passed."

