param(
    [string]$FeatureId,
    [switch]$MarkPassed,
    [string]$Evidence = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Save-Json([string]$Path, $Object) {
    $json = $Object | ConvertTo-Json -Depth 100
    Set-Content -Path $Path -Value $json
}

function Append-Progress([string]$Message) {
    $timestamp = (Get-Date).ToUniversalTime().ToString("s") + "Z"
    Add-Content -Path "claude-progress.txt" -Value "$timestamp | cycle | $Message"
}

if (-not (Test-Path "feature_list.json")) {
    throw "feature_list.json not found."
}

$data = Get-Content -Raw "feature_list.json" | ConvertFrom-Json

if ($MarkPassed) {
    if ([string]::IsNullOrWhiteSpace($FeatureId)) {
        throw "FeatureId is required when -MarkPassed is provided."
    }

    $target = $data.features | Where-Object { $_.id -eq $FeatureId } | Select-Object -First 1
    if ($null -eq $target) {
        throw "Feature not found: $FeatureId"
    }

    $target.status.passes = $true
    $target.status.last_verified_at = (Get-Date).ToUniversalTime().ToString("s") + "Z"
    if (-not [string]::IsNullOrWhiteSpace($Evidence)) {
        $target.status.evidence += $Evidence
    } else {
        $target.status.evidence += "manual-evidence-required"
    }

    Save-Json -Path "feature_list.json" -Object $data
    Append-Progress "Marked feature $FeatureId as passed."
    Write-Host "[cycle] Marked $FeatureId as passed."
    exit 0
}

$priorityOrder = @("P0", "P1", "P2")
$nextFeature = $null

foreach ($priority in $priorityOrder) {
    $candidate = $data.features | Where-Object {
        $_.priority -eq $priority -and $_.status.passes -eq $false
    } | Select-Object -First 1

    if ($null -ne $candidate) {
        $nextFeature = $candidate
        break
    }
}

if ($null -eq $nextFeature) {
    Append-Progress "No pending features. Delivery loop complete."
    Write-Host "[cycle] No pending features."
    exit 0
}

Append-Progress "Selected next feature: $($nextFeature.id) - $($nextFeature.title)"
Write-Host "[cycle] Next feature:"
Write-Host "  id: $($nextFeature.id)"
Write-Host "  title: $($nextFeature.title)"
Write-Host "  priority: $($nextFeature.priority)"
Write-Host "  platforms: $([string]::Join(',', $nextFeature.platforms))"
