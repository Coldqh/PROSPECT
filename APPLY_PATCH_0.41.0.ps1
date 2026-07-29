$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Required = @(
  "package.json",
  "src\sports\football\ecosystem\lifecycle.ts",
  "src\sports\football\pro\draft.ts",
  "src\sports\football\matches\realTimeEngine.ts",
  "scripts\check-player-lifecycle.mjs"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) {
    throw "Required 0.41.0 file is missing: $RelativePath. Extract the patch into C:\PROSPECT with replacement."
  }
}

$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.41\.0"') {
  throw "package.json is not PROSPECT 0.41.0. Check the extraction directory."
}

$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.41.0.txt"
if (Test-Path $DeleteList) {
  foreach ($RelativePath in Get-Content $DeleteList) {
    $RelativePath = $RelativePath.Trim()
    if (-not $RelativePath) { continue }
    $Target = Join-Path $ProjectRoot $RelativePath
    if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
  }
}

Write-Host "PROSPECT 0.41.0 installed."
Write-Host "Run: npm install; npm run test; npm run build; npm run dev"
