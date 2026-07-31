$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Required = @(
  "package.json",
  "src\styles\dynasty.css",
  "src\components\career\TodayDashboard.tsx",
  "src\components\career\TeamProfileDashboard.tsx",
  "src\components\career\PlayerProfileDashboard.tsx",
  "scripts\check-f1-dynasty-ui.mjs"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) { throw "Required 0.53.0 file is missing: $RelativePath" }
}
$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.53\.0"') { throw "package.json is not PROSPECT 0.53.0" }
$Team = Get-Content (Join-Path $ProjectRoot "src\components\career\TeamProfileDashboard.tsx") -Raw
$Profile = Get-Content (Join-Path $ProjectRoot "src\components\career\PlayerProfileDashboard.tsx") -Raw
$Today = Get-Content (Join-Path $ProjectRoot "src\components\career\TodayDashboard.tsx") -Raw
if ($Team -notmatch 'dynasty-team-masthead') { throw "New team composition is missing" }
if ($Profile -notmatch 'dynasty-profile-hero') { throw "New player composition is missing" }
if ($Today -notmatch 'dynasty-week-panel') { throw "New season-home composition is missing" }
Write-Host "PROSPECT 0.53.0 installed."
Write-Host "Run: npm test; npm run build"
