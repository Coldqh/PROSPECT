$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Required = @(
  "package.json",
  "src\\styles\\world.css",
  "scripts\\check-ui-architecture.mjs"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) { throw "Required 0.45.1 file is missing: $RelativePath" }
}
$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.45\.1"') { throw "package.json is not PROSPECT 0.45.1." }
Write-Host "PROSPECT 0.45.1 installed."
Write-Host "Run: npm install; npm run test; npm run build; npm run dev"
