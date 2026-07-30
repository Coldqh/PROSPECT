$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Required = @(
  "package.json",
  "src\sports\football\matches\performanceEvaluation.ts",
  "src\sports\football\matches\realTimeEngine.ts",
  "src\components\career\MatchDashboard.tsx",
  "src\components\career\LeagueDirectoryDashboard.tsx",
  "src\storage\saves\CareerRepository.ts",
  "scripts\check-functional-copy.mjs"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) {
    throw "Required 0.43.0 file is missing: $RelativePath. Extract the patch into C:\PROSPECT with replacement."
  }
}

$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
$Evaluation = Get-Content (Join-Path $ProjectRoot "src\sports\football\matches\performanceEvaluation.ts") -Raw
$Engine = Get-Content (Join-Path $ProjectRoot "src\sports\football\matches\realTimeEngine.ts") -Raw
$Repository = Get-Content (Join-Path $ProjectRoot "src\storage\saves\CareerRepository.ts") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.43\.0"') { throw "package.json is not PROSPECT 0.43.0." }
if ($Evaluation -notmatch 'gameCriteria') { throw "Full-game position grading is missing." }
if ($Engine -notmatch 'qbEscapeTarget') { throw "Stable QB pocket escape is missing." }
if ($Repository -notmatch 'AUTOSAVE_BACKUP_INTERVAL = 5') { throw "Snapshot cadence fix is missing." }

$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.43.0.txt"
if (Test-Path $DeleteList) {
  foreach ($RelativePath in Get-Content $DeleteList) {
    $RelativePath = $RelativePath.Trim()
    if (-not $RelativePath) { continue }
    $Target = Join-Path $ProjectRoot $RelativePath
    if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
  }
}

Write-Host "PROSPECT 0.43.0 installed."
Write-Host "Run: npm install; npm run test; npm run build; npm run dev"
