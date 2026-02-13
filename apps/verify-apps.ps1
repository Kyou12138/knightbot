Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    Write-Host "[verify-apps] FAIL: $Message"
    exit 1
}

Write-Host "[verify-apps] Verifying apps folder..."

if (-not (Test-Path ".\\apps")) {
    Fail "apps folder missing."
}

$appRoot = ".\\apps\\music-app"
if (-not (Test-Path $appRoot)) {
    Fail "Expected app not found: $appRoot"
}

$required = @(
    "$appRoot\\package.json",
    "$appRoot\\app.json",
    "$appRoot\\App.tsx",
    "$appRoot\\index.js",
    "$appRoot\\src\\api\\musicApi.ts",
    "$appRoot\\src\\hooks\\useAudioPlayer.ts",
    "$appRoot\\src\\components\\FestiveBackground.tsx",
    "$appRoot\\src\\components\\TrackCard.tsx",
    "$appRoot\\src\\styles\\theme.ts"
)

foreach ($file in $required) {
    if (-not (Test-Path $file)) {
        Fail "Missing file: $file"
    }
}

$pkg = Get-Content -Raw "$appRoot\\package.json" | ConvertFrom-Json
if (-not $pkg.dependencies.expo) { Fail "expo dependency missing in package.json" }
if (-not $pkg.dependencies.PSObject.Properties["expo-av"]) { Fail "expo-av dependency missing in package.json" }
if (-not $pkg.dependencies.PSObject.Properties["@react-native-async-storage/async-storage"]) { Fail "async-storage dependency missing in package.json" }
if (-not $pkg.dependencies.react) { Fail "react dependency missing in package.json" }

Write-Host "[verify-apps] PASS: apps/music-app scaffold present and looks consistent."
