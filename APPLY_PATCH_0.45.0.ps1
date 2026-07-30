$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Required = @(
  "package.json",
  "src\sports\football\matches\usage.ts",
  "src\sports\football\matches\realTimeEngine.ts",
  "src\sports\football\matches\simulateMatch.ts",
  "src\storage\saves\schema.ts"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) {
    throw "Required 0.45.0 file is missing: $RelativePath. Extract the patch into C:\PROSPECT with replacement."
  }
}

$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
$Schema = Get-Content (Join-Path $ProjectRoot "src\storage\saves\schema.ts") -Raw
$Usage = Get-Content (Join-Path $ProjectRoot "src\sports\football\matches\usage.ts") -Raw
$Engine = Get-Content (Join-Path $ProjectRoot "src\sports\football\matches\realTimeEngine.ts") -Raw

if ($Package -notmatch '"version"\s*:\s*"0\.45\.0"') { throw "package.json is not PROSPECT 0.45.0." }
if ($Schema -notmatch 'CURRENT_SCHEMA_VERSION\s*=\s*33') { throw "Save schema 33 is missing." }
if ($Usage -notmatch 'buildMatchUsagePlan') { throw "Usage plan is missing." }
if ($Engine -notmatch 'behindCoverage') { throw "QB coverage read is missing." }

$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.45.0.txt"
if (Test-Path $DeleteList) {
  foreach ($RelativePath in Get-Content $DeleteList) {
    $RelativePath = $RelativePath.Trim()
    if (-not $RelativePath) { continue }
    $Target = Join-Path $ProjectRoot $RelativePath
    if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
  }
}

Write-Host "PROSPECT 0.45.0 installed."
Write-Host "Run: npm install; npm run test; npm run build; npm run dev"
