$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Required = @(
  "package.json",
  "src\components\career\RecruitingDashboard.tsx",
  "src\components\career\MarketDashboard.tsx",
  "src\components\career\LeagueDirectoryDashboard.tsx",
  "scripts\check-interface-comprehension.mjs"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) { throw "Required 0.50.0 file is missing: $RelativePath" }
}
$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.50\.0"') { throw "package.json is not PROSPECT 0.50.0" }
Write-Host "PROSPECT 0.50.0 installed."
Write-Host "Run: npm test; npm run build"
