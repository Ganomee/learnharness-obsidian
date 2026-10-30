# Open this disposable vault using the isolated development profile.
$workspacePath = Split-Path -Parent $PSScriptRoot
$obsidianPath = Join-Path $env:LOCALAPPDATA 'Obsidian/Obsidian.exe'
if (-not (Test-Path -LiteralPath $obsidianPath)) { throw 'Obsidian executable not found.' }
$profilePath = Join-Path $workspacePath '.dev/obsidian-profile'
$notePath = Join-Path $workspacePath 'test-vault/Home.md'
$noteUri = 'obsidian://open?path=' + [Uri]::EscapeDataString($notePath)
Start-Process -FilePath $obsidianPath -ArgumentList '--disable-gpu', ('--user-data-dir="' + $profilePath + '"'), $noteUri
