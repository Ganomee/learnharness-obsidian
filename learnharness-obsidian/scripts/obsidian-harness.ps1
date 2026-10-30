[CmdletBinding()]
param(
  [ValidateSet('prepare','launch','status','all')]
  [string]$Mode = 'all'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$profilePath = Join-Path $root '.dev/obsidian-profile'
$runPath = Join-Path $root '.dev/obsidian-harness'
$manifestPath = Join-Path $runPath 'run-manifest.json'
$vaultPath = Join-Path $root 'test-vault'

function Write-Manifest {
  New-Item -ItemType Directory -Force -Path $runPath | Out-Null
  $manifest = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    vault = $vaultPath
    profile = $profilePath
    app = (Join-Path $env:LOCALAPPDATA 'Obsidian/Obsidian.exe')
    commands = @(
      'LearnHarness Lab: Open learning workspace'
      'LearnHarness Lab: Run offline runtime proof'
      'LearnHarness Lab: Open global knowledge graph'
    )
    selectors = @(
      '[data-lh-testid="learning-view"]'
      '[data-lh-testid="learning-mode"]'
      '[data-lh-testid="saved-sessions"]'
      '[data-lh-testid="session-status"]'
      '[data-lh-testid="global-graph-view"]'
      '[data-lh-action="start-scripted-demo"]'
      '[data-lh-action="continue-scripted-demo"]'
    )
    scenarios = @(
      'Open learning workspace and verify offline landing state'
      'Run the complete scripted lesson and verify progress, plan, question, answer, and completion states'
      'Reload Obsidian and resume the saved session'
      'Open global graph and verify search, filters, link modes, hover, click, and responsive layout'
      'Run offline runtime proof and verify the report is written and read back'
    )
  }
  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8
  Write-Output "Harness manifest: $manifestPath"
}

if ($Mode -in @('prepare','all')) {
  Push-Location $root
  try {
    npm.cmd run build
    npm.cmd run install:dev
    Write-Manifest
  } finally { Pop-Location }
}

if ($Mode -in @('launch','all')) {
  $app = Join-Path $env:LOCALAPPDATA 'Obsidian/Obsidian.exe'
  if (-not (Test-Path -LiteralPath $app)) { throw "Obsidian executable not found: $app" }
  & (Join-Path $PSScriptRoot 'open-vault.ps1')
  Write-Output "Launched isolated Obsidian profile: $profilePath"
}

if ($Mode -in @('status','all')) {
  $sessions = Join-Path $vaultPath 'LearnHarness/Sessions'
  $backups = Join-Path $vaultPath 'LearnHarness/SessionBackups'
  $proofs = Join-Path $vaultPath '95 Runtime proofs'
  [ordered]@{
    manifest = $manifestPath
    manifestExists = Test-Path -LiteralPath $manifestPath
    pluginBundle = Test-Path -LiteralPath (Join-Path $vaultPath '.obsidian/plugins/learnharness-lab/main.js')
    sessionCount = if (Test-Path -LiteralPath $sessions) { @(Get-ChildItem -LiteralPath $sessions -File -Filter '*.json').Count } else { 0 }
    backupCount = if (Test-Path -LiteralPath $backups) { @(Get-ChildItem -LiteralPath $backups -File -Recurse -Filter '*.json').Count } else { 0 }
    runtimeProofCount = if (Test-Path -LiteralPath $proofs) { @(Get-ChildItem -LiteralPath $proofs -File -Filter '*.md').Count } else { 0 }
  } | ConvertTo-Json -Depth 5
}