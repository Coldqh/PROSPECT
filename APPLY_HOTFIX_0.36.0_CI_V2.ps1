$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Career = Join-Path $ProjectRoot "src\sports\football\career\createFootballCareer.ts"
$Playbook = Join-Path $ProjectRoot "src\sports\football\matches\playbook.ts"
$Ecosystem = Join-Path $ProjectRoot "src\sports\football\ecosystem\simulateEcosystem.ts"
$RosterCreate = Join-Path $ProjectRoot "src\sports\football\ecosystem\createEcosystem.ts"
$StabilityTest = Join-Path $ProjectRoot "src\sports\football\ecosystem\stability.test.ts"
$RosterTest = Join-Path $ProjectRoot "src\sports\football\ecosystem\rosterManagement.test.ts"
$EcosystemTest = Join-Path $ProjectRoot "src\sports\football\ecosystem\ecosystem.test.ts"

foreach ($File in @($Career, $Playbook, $Ecosystem, $RosterCreate, $StabilityTest, $RosterTest, $EcosystemTest)) {
  if (-not (Test-Path $File)) {
    throw "Hotfix file missing: $File. Extract the ZIP directly into C:\PROSPECT."
  }
}

if ((Get-Content $Career -Raw) -notmatch 'CAREER_FOOTBALL_POSITIONS') {
  throw "Legacy migration import fix is missing."
}
if ((Get-Content $Playbook -Raw) -notmatch 'Math\.max\(0, Math\.min\(100, x\)\)') {
  throw "Match coordinate clamp is missing."
}
if (((Get-Content $Ecosystem -Raw) | Select-String -Pattern 'slice\(-800\)' -AllMatches).Matches.Count -lt 2) {
  throw "Expanded ecosystem transaction history is missing."
}
if ((Get-Content $RosterCreate -Raw) -notmatch 'normalizePositionRoomDepth') {
  throw "Depth chart normalization is missing."
}
if ((Get-Content $StabilityTest -Raw) -notmatch 'Math\.min\(20, 1 \+ report\.completedSeasons\)') {
  throw "Talent class history expectation fix is missing."
}
if ((Get-Content $RosterTest -Raw) -notmatch 'scholarshipStatus: "full" as const') {
  throw "Scholarship fixture isolation fix is missing."
}
if ((Get-Content $EcosystemTest -Raw) -notmatch '90_000') {
  throw "Offseason integration timeout fix is missing."
}

Write-Host "PROSPECT 0.36.0 cumulative CI hotfix v2 applied."
Write-Host "Run: npm run test; npm run build; npm run dev"
