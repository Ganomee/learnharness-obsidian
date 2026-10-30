# Open this disposable vault using the isolated development profile.
$workspacePath = Split-Path -Parent $PSScriptRoot
$obsidianPath = Join-Path $env:LOCALAPPDATA 'Obsidian/Obsidian.exe'
if (-not (Test-Path -LiteralPath $obsidianPath)) { throw 'Obsidian executable not found.' }
$profilePath = Join-Path $workspacePath '.dev/obsidian-profile'
$vaultPath = Join-Path $workspacePath 'test-vault'
$notePath = Join-Path $vaultPath 'Home.md'

# Obsidian resolves absolute-path URIs only against vaults registered in this
# profile. Keep the disposable harness profile pointed at this checkout after
# the repository or workspace has moved.
New-Item -ItemType Directory -Force -Path $profilePath | Out-Null
$registryPath = Join-Path $profilePath 'obsidian.json'
if (Test-Path -LiteralPath $registryPath) {
  $registry = Get-Content -LiteralPath $registryPath -Raw | ConvertFrom-Json
} else {
  $registry = [pscustomobject]@{ vaults = [pscustomobject]@{} }
}
if ($null -eq $registry.vaults) {
  $registry | Add-Member -MemberType NoteProperty -Name vaults -Value ([pscustomobject]@{})
}
$registered = $registry.vaults.PSObject.Properties | Where-Object { $_.Value.path -eq $vaultPath } | Select-Object -First 1
if ($registered) {
  $registered.Value.open = $true
} else {
  $vaultId = [Guid]::NewGuid().ToString('N').Substring(0, 16)
  $entry = [pscustomobject]@{
    path = $vaultPath
    ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    open = $true
  }
  $registry.vaults | Add-Member -MemberType NoteProperty -Name $vaultId -Value $entry
}
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($registryPath, ($registry | ConvertTo-Json -Depth 10), $utf8NoBom)
$noteUri = 'obsidian://open?path=' + [Uri]::EscapeDataString($notePath)
Start-Process -FilePath $obsidianPath -ArgumentList '--disable-gpu', ('--user-data-dir="' + $profilePath + '"'), $noteUri
