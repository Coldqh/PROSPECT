param(
  [switch]$SkipDependencies
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$PackageFile = Join-Path $ProjectRoot "package.json"
$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.40.0.txt"

if (-not (Test-Path $PackageFile)) {
  throw "package.json not found. Extract the patch into the PROSPECT project root."
}

$Version = (Get-Content $PackageFile -Raw | ConvertFrom-Json).version
if ($Version -ne "0.40.0") {
  throw "Patch files were not copied completely. Expected package version 0.40.0, found $Version."
}

if (Test-Path $DeleteList) {
  foreach ($RelativePath in Get-Content $DeleteList) {
    $Trimmed = $RelativePath.Trim()
    if (-not $Trimmed) { continue }
    $Target = Join-Path $ProjectRoot $Trimmed
    if (Test-Path $Target) { Remove-Item -Recurse -Force $Target }
  }
}

if (-not $SkipDependencies) {
  $NodeModules = Join-Path $ProjectRoot "node_modules"
  $FdirEsm = Join-Path $NodeModules "fdir\dist\index.mjs"
  if (-not (Test-Path $FdirEsm)) {
    Write-Host "Incomplete dependencies detected. Rebuilding node_modules..."
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
    if (Test-Path $NodeModules) { Remove-Item -Recurse -Force $NodeModules }
    Push-Location $ProjectRoot
    try {
      npm cache verify
      npm ci --no-audit --no-fund
      if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE" }
    }
    finally { Pop-Location }
  }
  if (-not (Test-Path $FdirEsm)) { throw "Dependency repair failed: node_modules\fdir\dist\index.mjs is missing." }
}

Write-Host "PROSPECT 0.40.0 LIVING PRO CAREER / PLAYER CONTROL applied."
Write-Host "Run: npm run test; npm run build; npm run dev"
