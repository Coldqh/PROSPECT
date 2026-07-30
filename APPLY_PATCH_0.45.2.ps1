$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Required = @(
  "package.json",
  "src\\styles\\world.css",
  "src\\components\\career\\LeagueDirectoryDashboard.tsx",
  "src\\components\\career\\TeamProfileDashboard.tsx",
  "src\\sports\\football\\ecosystem\\coaching.ts",
  "src\\sports\\football\\ecosystem\\createEcosystem.ts",
  "src\\sports\\football\\ecosystem\\simulateEcosystem.ts",
  "src\\sports\\football\\ecosystem\\social.ts",
  "src\\sports\\football\\ecosystem\\stability.ts",
  "src\\sports\\football\\ecosystem\\tactics.ts",
  "src\\sports\\football\\ecosystem\\types.ts",
  "src\\sports\\football\\ecosystem\\upgradeEcosystem.ts",
  "src\\sports\\football\\pro\\coaching.ts",
  "src\\sports\\football\\pro\\createProfessionalState.ts",
  "src\\sports\\football\\matches\\usage.ts",
  "scripts\\check-release-integrity.mjs",
  "scripts\\release-required-files.json",
)
foreach ($RelativePath in $Required) {
  $Path = Join-Path $ProjectRoot $RelativePath
  if (-not (Test-Path $Path)) { throw "Required 0.45.2 file is missing: $RelativePath" }
}
$Package = Get-Content (Join-Path $ProjectRoot "package.json") -Raw
if ($Package -notmatch '"version"\s*:\s*"0\.45\.2"') { throw "package.json is not PROSPECT 0.45.2." }
$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.45.2.txt"
if (Test-Path $DeleteList) {
  foreach ($RelativePath in Get-Content $DeleteList) {
    $RelativePath = $RelativePath.Trim()
    if (-not $RelativePath) { continue }
    $Target = Join-Path $ProjectRoot $RelativePath
    if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
  }
}
node (Join-Path $ProjectRoot "scripts\check-release-integrity.mjs")
Write-Host "PROSPECT 0.45.2 installed."
Write-Host "Run: npm run test; npm run build; npm run dev"
