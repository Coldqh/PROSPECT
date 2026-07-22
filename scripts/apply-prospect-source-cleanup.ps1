$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Test-ExactRelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $current = $Root
    foreach ($segment in ($RelativePath -split "/")) {
        if (-not (Test-Path -LiteralPath $current -PathType Container)) {
            return $false
        }

        $exactEntry = Get-ChildItem -LiteralPath $current -Force |
            Where-Object { $_.Name -ceq $segment } |
            Select-Object -First 1

        if ($null -eq $exactEntry) {
            return $false
        }

        $current = $exactEntry.FullName
    }

    return Test-Path -LiteralPath $current
}

$foreignPaths = @(
    "src/gameplay",
    "src/people",
    "src/world",
    "src/ui",
    "src/app/layout",
    "src/app/providers",
    "src/app/workspaces",
    "src/core/events",
    "src/core/ids",
    "src/core/saves",
    "src/core/simulation",
    "src/core/storage",
    "src/core/time",
    "src/core/version",
    "src/core/random/seededRandom.ts"
)

$removed = @()
foreach ($relativePath in $foreignPaths) {
    if (-not (Test-ExactRelativePath -Root $repoRoot -RelativePath $relativePath)) {
        continue
    }

    $fullPath = Join-Path $repoRoot $relativePath

    if (Get-Command git -ErrorAction SilentlyContinue) {
        & git rm -r -f --ignore-unmatch -- $relativePath | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "git rm failed for $relativePath"
        }
    }

    if (Test-ExactRelativePath -Root $repoRoot -RelativePath $relativePath) {
        Remove-Item -LiteralPath $fullPath -Recurse -Force
    }

    $removed += $relativePath
}

if ($removed.Count -eq 0) {
    Write-Host "Foreign PROSPECT sources were not found."
} else {
    Write-Host "Removed foreign source paths:"
    $removed | ForEach-Object { Write-Host " - $_" }
}

node "$PSScriptRoot/check-source-boundaries.mjs"
if ($LASTEXITCODE -ne 0) {
    throw "Source boundary check still fails after cleanup."
}
