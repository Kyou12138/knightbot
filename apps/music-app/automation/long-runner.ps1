param(
    [int]$Cycles = 5,
    [int]$SleepSeconds = 20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$runtimeDir = ".\\apps\\music-app\\.runtime"
$checkpointFile = Join-Path $runtimeDir "checkpoint.json"
$logFile = Join-Path $runtimeDir "runner.log"

if (-not (Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
}

function Log([string]$Message) {
    $ts = (Get-Date).ToUniversalTime().ToString("s") + "Z"
    $line = "$ts | $Message"
    Add-Content -Path $logFile -Value $line
    Write-Host "[long-runner] $line"
}

function Run-Step([string]$Name, [scriptblock]$Action) {
    try {
        & $Action
        Log "$Name=PASS"
        return $true
    } catch {
        Log "$Name=FAIL | $($_.Exception.Message)"
        return $false
    }
}

for ($i = 1; $i -le $Cycles; $i++) {
    $ok = $true
    Log "cycle=$i start"

    $ok = $ok -and (Run-Step "verify-apps" { powershell -ExecutionPolicy Bypass -File .\\apps\\verify-apps.ps1 | Out-Null })
    $ok = $ok -and (Run-Step "typecheck" { npm --prefix .\\apps\\music-app run typecheck | Out-Null })
    $ok = $ok -and (Run-Step "unit-tests" { npm --prefix .\\apps\\music-app run test:unit | Out-Null })
    $ok = $ok -and (Run-Step "e2e-tests" { npm --prefix .\\apps\\music-app run test:e2e | Out-Null })

    $checkpoint = [pscustomobject]@{
        cycle = $i
        status = if ($ok) { "PASS" } else { "FAIL" }
        updated_at = (Get-Date).ToUniversalTime().ToString("s") + "Z"
    }
    $checkpoint | ConvertTo-Json | Set-Content -Path $checkpointFile

    if (-not $ok) {
        Log "cycle=$i halted"
        exit 1
    }

    if ($i -lt $Cycles) {
        Start-Sleep -Seconds $SleepSeconds
    }
}

Log "all-cycles=PASS"
