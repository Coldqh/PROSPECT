$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Required = @(
  "package.json",
  "src\sports\football\matches\realTimeEngine.ts",
  "src\sports\football\matches\performanceEvaluation.ts",
  "src\sports\football\matches\realTimeEngine.test.ts",
  "src\sports\football\matches\performanceEvaluation.test.ts"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) {
    throw "Required 0.42.1 file is missing: $RelativePath. Extract the patch into C:\PROSPECT with replacement."
  }
}

$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.42\.1"') {
  throw "package.json is not PROSPECT 0.42.1. Check the extraction directory."
}

$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.42.1.txt"
if (Test-Path $DeleteList) {
  foreach ($RelativePath in Get-Content $DeleteList) {
    $RelativePath = $RelativePath.Trim()
    if (-not $RelativePath) { continue }
    $Target = Join-Path $ProjectRoot $RelativePath
    if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
  }
}

Write-Host "PROSPECT 0.42.1 installed."
Write-Host "Run: npm install; npm run test; npm run build; npm run dev"
