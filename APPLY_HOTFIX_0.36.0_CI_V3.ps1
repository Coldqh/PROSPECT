$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Package = Join-Path $ProjectRoot "package.json"
$Career = Join-Path $ProjectRoot "src\sports\football\career\createFootballCareer.ts"
$Playbook = Join-Path $ProjectRoot "src\sports\football\matches\playbook.ts"
$Ecosystem = Join-Path $ProjectRoot "src\sports\football\ecosystem\simulateEcosystem.ts"
$RosterCreate = Join-Path $ProjectRoot "src\sports\football\ecosystem\createEcosystem.ts"
$StabilityTest = Join-Path $ProjectRoot "src\sports\football\ecosystem\stability.test.ts"
$DeterminismTest = Join-Path $ProjectRoot "src\sports\football\ecosystem\stabilityDeterminism.test.ts"
$StabilityUtils = Join-Path $ProjectRoot "src\sports\football\ecosystem\stabilityTestUtils.ts"
$RosterTest = Join-Path $ProjectRoot "src\sports\football\ecosystem\rosterManagement.test.ts"
$EcosystemTest = Join-Path $ProjectRoot "src\sports\football\ecosystem\ecosystem.test.ts"

foreach ($File in @(
  $Package,
  $Career,
  $Playbook,
  $Ecosystem,
  $RosterCreate,
  $StabilityTest,
  $DeterminismTest,
  $StabilityUtils,
  $RosterTest,
  $EcosystemTest
)) {
  if (-not (Test-Path $File)) {
    throw "Hotfix file missing: $File. Extract the ZIP directly into C:\PROSPECT."
  }
}

$PackageJson = Get-Content $Package -Raw
if ($PackageJson -notmatch '"test:unit"') {
  throw "Separated unit-test script is missing."
}
if ($PackageJson -notmatch '"test:stability"') {
  throw "Separated stability-test script is missing."
}
if ($PackageJson -notmatch 'stabilityDeterminism\.test\.ts --maxWorkers=1 --no-file-parallelism') {
  throw "Isolated deterministic stability run is missing."
}
if ((Get-Content $StabilityTest -Raw) -match 'produces the same two-season report') {
  throw "The old 60-second combined stability suite is still present."
}
if ((Get-Content $DeterminismTest -Raw) -notmatch 'produces the same two-season report') {
  throw "The deterministic stability suite was not extracted correctly."
}
if ((Get-Content $StabilityUtils -Raw) -notmatch 'createStabilitySave') {
  throw "Shared stability fixture is missing."
}

# Verify that every previous cumulative CI fix is still present.
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

Write-Host "PROSPECT 0.36.0 cumulative CI hotfix v3 applied."
Write-Host "Long stability checks now run as two isolated Vitest processes."
Write-Host "Run: npm run test; npm run build; npm run dev"
