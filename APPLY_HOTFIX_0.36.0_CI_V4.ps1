$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$RequiredFiles = @(
  "package.json",
  "src\sports\football\career\createFootballCareer.ts",
  "src\sports\football\matches\playbook.ts",
  "src\sports\football\matches\types.ts",
  "src\sports\football\college\types.ts",
  "src\sports\football\college\heroCareer.ts",
  "src\sports\football\pro\draft.ts",
  "src\storage\saves\schema.ts",
  "src\components\career\PlayerProfileDashboard.tsx",
  "src\components\career\MatchDashboard.tsx",
  "src\sports\football\ecosystem\stability.test.ts",
  "src\sports\football\ecosystem\stabilityDeterminism.test.ts",
  "src\sports\football\ecosystem\stabilityTestUtils.ts"
)

foreach ($RelativePath in $RequiredFiles) {
  $File = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $File)) {
    throw "Hotfix file missing: $File. Extract the ZIP directly into C:\PROSPECT."
  }
}

$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
$Career = Get-Content (Join-Path $ProjectRoot "src\sports\football\career\createFootballCareer.ts") -Raw
$Playbook = Get-Content (Join-Path $ProjectRoot "src\sports\football\matches\playbook.ts") -Raw
$CollegeTypes = Get-Content (Join-Path $ProjectRoot "src\sports\football\college\types.ts") -Raw
$HeroCareer = Get-Content (Join-Path $ProjectRoot "src\sports\football\college\heroCareer.ts") -Raw
$Draft = Get-Content (Join-Path $ProjectRoot "src\sports\football\pro\draft.ts") -Raw
$Schema = Get-Content (Join-Path $ProjectRoot "src\storage\saves\schema.ts") -Raw
$PlayerProfile = Get-Content (Join-Path $ProjectRoot "src\components\career\PlayerProfileDashboard.tsx") -Raw
$MatchDashboard = Get-Content (Join-Path $ProjectRoot "src\components\career\MatchDashboard.tsx") -Raw
$Stability = Get-Content (Join-Path $ProjectRoot "src\sports\football\ecosystem\stability.test.ts") -Raw
$Determinism = Get-Content (Join-Path $ProjectRoot "src\sports\football\ecosystem\stabilityDeterminism.test.ts") -Raw

# Previous cumulative fixes.
if ($Career -notmatch 'CAREER_FOOTBALL_POSITIONS') { throw "Legacy migration import fix is missing." }
if ($Playbook -notmatch 'Math\.max\(0, Math\.min\(100, x\)\)') { throw "Match coordinate clamp is missing." }
if ($Package -notmatch '"test:stability"') { throw "Isolated stability-test script is missing." }
if ($Stability -match 'produces the same two-season report') { throw "Combined 60-second stability suite is still present." }
if ($Determinism -notmatch 'produces the same two-season report') { throw "Determinism suite is missing." }

# v4 build fixes.
if ($CollegeTypes -notmatch 'stats\?: MatchStatLine') { throw "Full college game-stat contract is missing." }
if ($Schema -notmatch 'collegeHeroGameStatLineSchema\.optional\(\)') { throw "Backward-compatible college game-stat schema is missing." }
if ($HeroCareer -notmatch 'stats: \{ \.\.\.matchStats \}') { throw "Exact full-match stat persistence is missing." }
if ($Draft -notmatch 'gameProduction\(stats: Partial<MatchStatLine>\)') { throw "Draft production compatibility fix is missing." }
if ($Playbook -notmatch 'const returnAssignments: MatchPlayerAssignment\[\]') { throw "Special-teams assignment typing fix is missing." }
if ($PlayerProfile -notmatch 'stats: MatchStatLine') { throw "Player profile stat accumulator typing fix is missing." }
if ($MatchDashboard -notmatch 'useRef<string \| undefined>\(undefined\)') { throw "React 19 useRef initialization fix is missing." }

Write-Host "PROSPECT 0.36.0 cumulative CI/build hotfix v4 applied."
Write-Host "Run: npm run test; npm run build; npm run dev"
