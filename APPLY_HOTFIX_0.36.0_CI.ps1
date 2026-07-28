$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Career = Join-Path $ProjectRoot "src\sports\football\career\createFootballCareer.ts"
$Playbook = Join-Path $ProjectRoot "src\sports\football\matches\playbook.ts"
$Ecosystem = Join-Path $ProjectRoot "src\sports\football\ecosystem\simulateEcosystem.ts"
$Roster = Join-Path $ProjectRoot "src\sports\football\ecosystem\createEcosystem.ts"

foreach ($File in @($Career, $Playbook, $Ecosystem, $Roster)) {
  if (-not (Test-Path $File)) {
    throw "Hotfix file missing: $File. Extract the ZIP directly into C:\PROSPECT."
  }
}

if ((Get-Content $Career -Raw) -notmatch 'CAREER_FOOTBALL_POSITIONS') {
  throw "Career migration fix is missing."
}
if ((Get-Content $Playbook -Raw) -notmatch 'Math\.max\(0, Math\.min\(100, x\)\)') {
  throw "Match coordinate clamp is missing."
}
if (((Get-Content $Ecosystem -Raw) | Select-String -Pattern 'slice\(-800\)' -AllMatches).Matches.Count -lt 2) {
  throw "Expanded ecosystem transaction history is missing."
}
if ((Get-Content $Roster -Raw) -notmatch 'normalizePositionRoomDepth') {
  throw "Depth chart normalization is missing."
}

Write-Host "PROSPECT 0.36.0 cumulative CI hotfix applied."
Write-Host "Run: npm run test; npm run build; npm run dev"
