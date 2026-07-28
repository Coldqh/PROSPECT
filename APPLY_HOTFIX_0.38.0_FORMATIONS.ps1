$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$PackagePath = Join-Path $ProjectRoot "package.json"
$PlaybookPath = Join-Path $ProjectRoot "src\sports\football\matches\playbook.ts"
$EnginePath = Join-Path $ProjectRoot "src\sports\football\matches\realTimeEngine.ts"
$FieldPath = Join-Path $ProjectRoot "src\components\career\RealTimeMatchField.tsx"
$GeometryTestPath = Join-Path $ProjectRoot "src\sports\football\matches\formationGeometry.test.ts"

foreach ($Path in @($PackagePath, $PlaybookPath, $EnginePath, $FieldPath, $GeometryTestPath)) {
  if (-not (Test-Path $Path)) {
    throw "Required file not found: $Path. Extract the ZIP directly into C:\PROSPECT."
  }
}

$Package = Get-Content $PackagePath -Raw
$Playbook = Get-Content $PlaybookPath -Raw
$Engine = Get-Content $EnginePath -Raw
$Field = Get-Content $FieldPath -Raw

if ($Package -notmatch '"version"\s*:\s*"0\.38\.0"') {
  Write-Warning "Project version is not 0.38.0. Verify the project state before push."
}
if ($Playbook -notmatch 'const PLAY_LOS_Y = 60') {
  throw "Real-yard formation geometry is missing from playbook.ts."
}
if ($Playbook -notmatch 'defenseY\(13\.5\)') {
  throw "Realistic safety depth is missing from playbook.ts."
}
if ($Engine -notmatch 'state\.phase === "pre-snap"') {
  throw "Pre-snap camera correction is missing from realTimeEngine.ts."
}
if ($Field -notmatch '#2f78d0') {
  throw "Visible offense color is missing from RealTimeMatchField.tsx."
}

Write-Host "PROSPECT 0.38.0 formation geometry hotfix applied."
Write-Host "Run: npm run test; npm run build; npm run dev"
