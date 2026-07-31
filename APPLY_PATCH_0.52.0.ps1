$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Required = @(
  "package.json",
  "src\styles\index.css",
  "src\styles\shell.css",
  "src\styles\management.css",
  "scripts\check-f1-dynasty-ui.mjs",
  "DELETE_FILES_0.52.0.txt"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) { throw "Required 0.52.0 file is missing: $RelativePath" }
}
foreach ($RelativePath in Get-Content (Join-Path $ProjectRoot "DELETE_FILES_0.52.0.txt")) {
  $RelativePath = $RelativePath.Trim()
  if (-not $RelativePath -or $RelativePath.StartsWith("#")) { continue }
  $Target = Join-Path $ProjectRoot $RelativePath
  if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
}
$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.52\.0"') { throw "package.json is not PROSPECT 0.52.0" }
Write-Host "PROSPECT 0.52.0 installed. Retired UI files removed."
Write-Host "Run: npm test; npm run build"
