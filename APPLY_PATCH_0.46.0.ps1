$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Required = @(
  "package.json",
  "src\storage\saves\worldSlices.ts",
  "src\storage\indexedDb\database.ts",
  "src\sports\football\matches\participation.ts",
  "src\components\career\ProfessionalSeasonDashboard.tsx",
  "scripts\check-core-consolidation.mjs"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) { throw "Required 0.46.0 file is missing: $RelativePath" }
}
$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
$Database = Get-Content (Join-Path $ProjectRoot "src\storage\indexedDb\database.ts") -Raw
$Schema = Get-Content (Join-Path $ProjectRoot "src\storage\saves\schema.ts") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.46\.0"') { throw "package.json is not PROSPECT 0.46.0" }
if ($Database -notmatch 'openDB<ProspectDatabase>\("prospect-db", 2') { throw "IndexedDB schema 2 is missing" }
if ($Schema -notmatch 'CURRENT_SCHEMA_VERSION\s*=\s*33') { throw "Save schema 33 is missing" }
$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.46.0.txt"
if (Test-Path $DeleteList) {
  foreach ($RelativePath in Get-Content $DeleteList) {
    $RelativePath = $RelativePath.Trim()
    if (-not $RelativePath) { continue }
    $Target = Join-Path $ProjectRoot $RelativePath
    if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
  }
}
Write-Host "PROSPECT 0.46.0 installed."
Write-Host "Run: npm install; npm run test; npm run build; npm run dev"
