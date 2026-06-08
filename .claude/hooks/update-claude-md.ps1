# Detects newly created source files in backend/src or frontend/src.
# Exits with code 2 if found, which triggers asyncRewake to wake Claude for CLAUDE.md update.

$repoRoot = "f:/My Project/sportivox-main/sportivox-main"
Set-Location $repoRoot

$status = git status --porcelain 2>$null
if (-not $status) { exit 0 }

$newSrcFiles = @($status | Where-Object {
    $line = $_
    if ($line.Length -le 3) { return $false }
    $xy = $line.Substring(0, 2)
    $path = $line.Substring(3).Trim()
    $isNew = ($xy -eq 'A ' -or $xy -eq '??' -or $xy -eq 'AM')
    $isSrc = ($path -like '*backend/src*' -or $path -like '*frontend/src*')
    $isCode = ($path -like '*.ts' -or $path -like '*.tsx')
    return ($isNew -and $isSrc -and $isCode)
})

if ($newSrcFiles.Count -ge 1) {
    $fileList = ($newSrcFiles | Select-Object -First 12 | ForEach-Object { "  - " + $_.Substring(3).Trim() }) -join "`n"
    Write-Output "New source files in this session:`n$fileList"
    exit 2
}

exit 0
