$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Required = @(
  "package.json",
  "src\sports\football\matches\realTimeEngine.test.ts"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) {
    throw "Required 0.43.1 file is missing: $RelativePath. Extract the patch into C:\PROSPECT with replacement."
  }
}

$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
$Test = Get-Content (Join-Path $ProjectRoot "src\sports\football\matches\realTimeEngine.test.ts") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.43\.1"') { throw "package.json is not PROSPECT 0.43.1." }
if ($Test -notmatch 'frame < 1400') { throw "Long-touchdown regression timeout fix is missing." }

$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.43.1.txt"
if (Test-Path $DeleteList) {
  foreach ($RelativePath in Get-Content $DeleteList) {
    $RelativePath = $RelativePath.Trim()
    if (-not $RelativePath) { continue }
    $Target = Join-Path $ProjectRoot $RelativePath
    if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
  }
}

Write-Host "PROSPECT 0.43.1 installed."
Write-Host "Run: npm install; npm run test; npm run build; npm run dev"
