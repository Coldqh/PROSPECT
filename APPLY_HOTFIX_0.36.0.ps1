$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Target = Join-Path $ProjectRoot "src\sports\football\career\createFootballCareer.ts"

if (-not (Test-Path $Target)) {
  throw "createFootballCareer.ts not found. Extract the hotfix into C:\PROSPECT."
}

$Source = Get-Content $Target -Raw
if ($Source -notmatch 'import \{ CAREER_FOOTBALL_POSITIONS \} from "\.\/types";') {
  throw "Hotfix file was not copied correctly."
}

Write-Host "PROSPECT 0.36.0 migration hotfix applied."
Write-Host "Run: npm run test; npm run build; npm run dev"
