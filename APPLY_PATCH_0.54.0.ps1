$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Required = @(
  "package.json",
  "src\components\career\ManagerPageHeader.tsx",
  "src\components\career\RecruitingDashboard.tsx",
  "src\components\career\MarketDashboard.tsx",
  "src\components\career\LeagueDirectoryDashboard.tsx",
  "src\components\career\WorldDashboard.tsx",
  "src\components\career\ProfessionalTransitionDashboard.tsx",
  "src\components\career\MatchDashboard.tsx",
  "scripts\check-complete-ui-migration.mjs"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) { throw "Required 0.54.0 file is missing: $RelativePath" }
}
$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.54\.0"') { throw "package.json is not PROSPECT 0.54.0" }
node (Join-Path $ProjectRoot "scripts\check-complete-ui-migration.mjs")
Write-Host "PROSPECT 0.54.0 installed."
Write-Host "Run: npm test; npm run build"
