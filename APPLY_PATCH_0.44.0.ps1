$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Required = @(
  "package.json",
  "src\sports\football\ecosystem\coaching.ts",
  "src\sports\football\pro\coaching.ts",
  "src\sports\football\matches\playbook.ts",
  "src\storage\saves\schema.ts"
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) {
    throw "Required 0.44.0 file is missing: $RelativePath. Extract the patch into C:\PROSPECT with replacement."
  }
}

$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
$Schema = Get-Content (Join-Path $ProjectRoot "src\storage\saves\schema.ts") -Raw
$ProfessionalCoaching = Get-Content (Join-Path $ProjectRoot "src\sports\football\pro\coaching.ts") -Raw
$Playbook = Get-Content (Join-Path $ProjectRoot "src\sports\football\matches\playbook.ts") -Raw

if ($Package -notmatch '"version"\s*:\s*"0\.44\.0"') { throw "package.json is not PROSPECT 0.44.0." }
if ($Schema -notmatch 'CURRENT_SCHEMA_VERSION\s*=\s*32') { throw "Save schema 32 is missing." }
if ($ProfessionalCoaching -notmatch 'professionalSchemeFit') { throw "Professional scheme fit is missing." }
if ($Playbook -notmatch 'PlayCallStrategy') { throw "Adaptive play-call strategy is missing." }

$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.44.0.txt"
if (Test-Path $DeleteList) {
  foreach ($RelativePath in Get-Content $DeleteList) {
    $RelativePath = $RelativePath.Trim()
    if (-not $RelativePath) { continue }
    $Target = Join-Path $ProjectRoot $RelativePath
    if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
  }
}

Write-Host "PROSPECT 0.44.0 installed."
Write-Host "Run: npm install; npm run test; npm run build; npm run dev"
