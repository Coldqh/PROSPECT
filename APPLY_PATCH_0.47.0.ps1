$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Required = @(
  "package.json",
  "src\sports\football\ecosystem\history.ts",
  "src\sports\football\ecosystem\history.test.ts",
  "scripts\check-world-history.mjs"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) { throw "Required 0.47.0 file is missing: $RelativePath" }
}
$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
$Schema = Get-Content (Join-Path $ProjectRoot "src\storage\saves\schema.ts") -Raw
$Types = Get-Content (Join-Path $ProjectRoot "src\sports\football\ecosystem\types.ts") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.47\.0"') { throw "package.json is not PROSPECT 0.47.0" }
if ($Schema -notmatch 'CURRENT_SCHEMA_VERSION\s*=\s*34') { throw "Save schema 34 is missing" }
if ($Types -notmatch 'ECOSYSTEM_MODULE_VERSION\s*=\s*13') { throw "Ecosystem module 13 is missing" }
Write-Host "PROSPECT 0.47.0 installed."
Write-Host "Run: npm test; npm run build"
