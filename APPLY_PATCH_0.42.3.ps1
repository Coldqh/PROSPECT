$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Required = @(
  "package.json",
  "src\components\career\RealTimeMatchField.tsx",
  "src\sports\football\pro\camp.test.ts",
  "src\sports\football\pro\campFreeAgency.test.ts",
  "src\sports\football\pro\leagueStructure.test.ts",
  "src\sports\football\pro\league.test.ts",
  "src\sports\football\pro\leaguePractice.test.ts",
  "src\sports\football\pro\leagueSeason.test.ts",
  "scripts\run-professional-tests.mjs"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) {
    throw "Required 0.42.3 file is missing: $RelativePath. Extract the patch into C:\PROSPECT with replacement."
  }
}

$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
$Field = Get-Content (Join-Path $ProjectRoot "src\components\career\RealTimeMatchField.tsx") -Raw
$Runner = Get-Content (Join-Path $ProjectRoot "scripts\run-professional-tests.mjs") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.42\.3"') {
  throw "package.json is not PROSPECT 0.42.3. Check the extraction directory."
}
if ($Field -notmatch '#35c96f') {
  throw "Green hero marker is missing."
}
if ($Runner -notmatch 'leagueSeason\.test\.ts') {
  throw "Isolated professional test runner is missing."
}

$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.42.3.txt"
if (Test-Path $DeleteList) {
  foreach ($RelativePath in Get-Content $DeleteList) {
    $RelativePath = $RelativePath.Trim()
    if (-not $RelativePath) { continue }
    $Target = Join-Path $ProjectRoot $RelativePath
    if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
  }
}

Write-Host "PROSPECT 0.42.3 installed."
Write-Host "Run: npm install; npm run test; npm run build; npm run dev"
