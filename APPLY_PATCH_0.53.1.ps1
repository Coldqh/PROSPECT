$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Required = @(
  "package.json",
  "src\styles\controls.css",
  "src\styles\career.css",
  "src\styles\management.css",
  "src\styles\match.css",
  "src\styles\flows.css",
  "src\styles\shell.css",
  "scripts\check-f1-dynasty-ui.mjs"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) { throw "Required 0.53.1 file is missing: $RelativePath" }
}
$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.53\.1"') { throw "package.json is not PROSPECT 0.53.1" }
$Styles = Get-ChildItem (Join-Path $ProjectRoot "src\styles") -Filter *.css | Get-Content -Raw
$Forbidden = @("background: #fff", "background: #ffffff", "background: #f8fafb", "background: #f6f8fa", "background: #edf3f8", "background: #e9edf1", "%, white)")
foreach ($Token in $Forbidden) {
  if ($Styles -match [regex]::Escape($Token)) { throw "Legacy light surface remains: $Token" }
}
Write-Host "PROSPECT 0.53.1 installed."
Write-Host "Run: npm test; npm run build"
