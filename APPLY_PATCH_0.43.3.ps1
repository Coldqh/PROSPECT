$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Required = @(
  "package.json",
  "src\storage\saves\checksum.ts",
  "src\sports\football\relationships\relationshipEvents.ts",
  "src\hooks\useCareerSave.ts"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) {
    throw "Required 0.43.3 file is missing: $RelativePath. Extract the patch into C:\PROSPECT with replacement."
  }
}

$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
$Checksum = Get-Content (Join-Path $ProjectRoot "src\storage\saves\checksum.ts") -Raw
$Relationships = Get-Content (Join-Path $ProjectRoot "src\sports\football\relationships\relationshipEvents.ts") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.43\.3"') { throw "package.json is not PROSPECT 0.43.3." }
if ($Checksum -notmatch 'hash\.write\("undefined"\)') { throw "Undefined checksum support is missing." }
if ($Relationships -notmatch 'relationshipStateWithoutPending') { throw "Resolved event cleanup is missing." }

$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.43.3.txt"
if (Test-Path $DeleteList) {
  foreach ($RelativePath in Get-Content $DeleteList) {
    $RelativePath = $RelativePath.Trim()
    if (-not $RelativePath) { continue }
    $Target = Join-Path $ProjectRoot $RelativePath
    if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
  }
}

Write-Host "PROSPECT 0.43.3 installed."
Write-Host "Run: npm install; npm run test; npm run build; npm run dev"
