$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Required = @(
  "package.json",
  "src\sports\football\pro\draft.test.ts",
  "src\sports\football\pro\camp.test.ts",
  "src\sports\football\pro\league.test.ts",
  "src\sports\football\pro\professionalTestFixtures.ts",
  "scripts\check-professional-league.mjs",
  "src\test\setup.ts"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) {
    throw "Required 0.42.2 file is missing: $RelativePath. Extract the patch into C:\PROSPECT with replacement."
  }
}

$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.42\.2"') {
  throw "package.json is not PROSPECT 0.42.2. Check the extraction directory."
}
if ($Package -notmatch 'src/sports/football/pro/camp\.test\.ts') {
  throw "Separated professional test suite is missing from package.json."
}
if ($Package -notmatch '\-\-environment=node') {
  throw "Professional tests are not configured for the node environment."
}

$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.42.2.txt"
if (Test-Path $DeleteList) {
  foreach ($RelativePath in Get-Content $DeleteList) {
    $RelativePath = $RelativePath.Trim()
    if (-not $RelativePath) { continue }
    $Target = Join-Path $ProjectRoot $RelativePath
    if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
  }
}

Write-Host "PROSPECT 0.42.2 installed."
Write-Host "Run: npm install; npm run test; npm run build; npm run dev"
