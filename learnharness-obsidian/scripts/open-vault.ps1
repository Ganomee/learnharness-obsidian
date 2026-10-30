# Open this disposable vault using the isolated development profile.
$workspacePath = Split-Path -Parent $PSScriptRoot
$obsidianPath = Join-Path $env:LOCALAPPDATA 'Obsidian/Obsidian.exe'
if (-not (Test-Path -LiteralPath $obsidianPath)) { throw 'Obsidian executable not found.' }
$profilePath = Join-Path $workspacePath '.dev/obsidian-profile'
$vaultPath = Join-Path $workspacePath 'test-vault'

# The obsidian:// protocol handler is registered to the normal desktop
# instance, so sending a URI while starting an isolated profile routes it to
# the wrong registry and raises “Vault not found”. The isolated profile's
# registry already marks this disposable vault open; launch it directly.
$registryPath = Join-Path $profilePath 'obsidian.json'
if (-not (Test-Path -LiteralPath $registryPath)) { throw "Isolated Obsidian vault registry is missing: $registryPath" }
$registry = Get-Content -LiteralPath $registryPath -Raw | ConvertFrom-Json
$registered = $registry.vaults.PSObject.Properties | Where-Object { [System.IO.Path]::GetFullPath($_.Value.path) -eq [System.IO.Path]::GetFullPath($vaultPath) } | Select-Object -First 1
if (-not $registered) { throw "Disposable vault is not registered in the isolated profile: $vaultPath" }
Start-Process -FilePath $obsidianPath -ArgumentList '--disable-gpu', ('--user-data-dir="' + $profilePath + '"')
