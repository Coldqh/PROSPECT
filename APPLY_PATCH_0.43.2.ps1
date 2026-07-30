$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Required = @(
  "package.json",
  "src\sports\football\pro\professionalTestFixtures.ts",
  "src\sports\football\pro\leagueStructure.test.ts"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) {
    throw "Required 0.43.2 file is missing: $RelativePath. Extract the patch into C:\PROSPECT with replacement."
  }
}

$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
$Fixture = Get-Content (Join-Path $ProjectRoot "src\sports\football\pro\professionalTestFixtures.ts") -Raw
$Test = Get-Content (Join-Path $ProjectRoot "src\sports\football\pro\leagueStructure.test.ts") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.43\.2"') { throw "package.json is not PROSPECT 0.43.2." }
if ($Fixture -notmatch 'position:\s*"EDGE"') { throw "Deterministic EDGE fixture is missing." }
if ($Test -notmatch 'keeps specialist participation separate') { throw "Specialist participation regression test is missing." }

$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.43.2.txt"
if (Test-Path $DeleteList) {
  foreach ($RelativePath in Get-Content $DeleteList) {
    $RelativePath = $RelativePath.Trim()
    if (-not $RelativePath) { continue }
    $Target = Join-Path $ProjectRoot $RelativePath
    if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
  }
}

Write-Host "PROSPECT 0.43.2 installed."
Write-Host "Run: npm install; npm run test; npm run build; npm run dev"
