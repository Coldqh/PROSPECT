$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Required = @(
  "package.json",
  "src\styles\operations.css",
  "src\components\career\teamBrand.ts",
  "src\components\career\RecruitingDashboard.tsx",
  "src\components\career\MarketDashboard.tsx",
  "src\components\career\LeagueDirectoryDashboard.tsx",
  "scripts\check-visual-workbench.mjs"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) { throw "Required 0.51.0 file is missing: $RelativePath" }
}
$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.51\.0"') { throw "package.json is not PROSPECT 0.51.0" }
Write-Host "PROSPECT 0.51.0 installed."
Write-Host "Run: npm test; npm run build"
