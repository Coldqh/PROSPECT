$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$PackagePath = Join-Path $ProjectRoot "package.json"
$TestPath = Join-Path $ProjectRoot "src\sports\football\matches\realTimeEngine.test.ts"

if (-not (Test-Path $PackagePath)) {
  throw "package.json not found. Extract the ZIP directly into C:\PROSPECT."
}
if (-not (Test-Path $TestPath)) {
  throw "realTimeEngine.test.ts not found. Extract the ZIP directly into C:\PROSPECT."
}

$Package = Get-Content $PackagePath -Raw
$Test = Get-Content $TestPath -Raw

if ($Package -notmatch '"version"\s*:\s*"0\.38\.0"') {
  Write-Warning "Project version is not 0.38.0. The test fix can still work, but verify the project state."
}
if ($Test -notmatch '\["completion", "incomplete", "touchdown"\]') {
  throw "The corrected physical-pass assertion is missing."
}
if ($Test -notmatch 'expect\(state\.outcome\?\.turnover\)\.toBe\(false\)') {
  throw "The no-turnover regression assertion is missing."
}

Write-Host "PROSPECT 0.38.0 real-time pass test hotfix applied."
Write-Host "Run: npm run test; npm run build; npm run dev"
