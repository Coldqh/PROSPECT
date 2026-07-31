$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Required = @(
  "package.json",
  "src\sports\football\ecosystem\agency.ts",
  "src\sports\football\ecosystem\agency.test.ts",
  "scripts\check-world-agency.mjs"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) { throw "Required 0.48.0 file is missing: $RelativePath" }
}
$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
$Schema = Get-Content (Join-Path $ProjectRoot "src\storage\saves\schema.ts") -Raw
$Types = Get-Content (Join-Path $ProjectRoot "src\sports\football\ecosystem\types.ts") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.48\.0"') { throw "package.json is not PROSPECT 0.48.0" }
if ($Schema -notmatch 'CURRENT_SCHEMA_VERSION\s*=\s*35') { throw "Save schema 35 is missing" }
if ($Types -notmatch 'ECOSYSTEM_MODULE_VERSION\s*=\s*14') { throw "Ecosystem module 14 is missing" }
Write-Host "PROSPECT 0.48.0 installed."
Write-Host "Run: npm test; npm run build"
