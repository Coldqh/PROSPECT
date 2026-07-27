$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$DeleteList = Join-Path $ProjectRoot "DELETE_FILES_0.31.0.txt"

if (Test-Path $DeleteList) {
  Get-Content $DeleteList | ForEach-Object {
    $RelativePath = $_.Trim()
    if ($RelativePath) {
      $Target = Join-Path $ProjectRoot $RelativePath
      if (Test-Path $Target) {
        Remove-Item $Target -Force
        Write-Host "Deleted $RelativePath"
      }
    }
  }
}

Write-Host "PROSPECT 0.31.0 patch applied. Run: npm install; npm run dev"
