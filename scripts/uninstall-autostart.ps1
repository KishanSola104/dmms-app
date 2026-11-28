$ErrorActionPreference = 'Continue'
$RootDir = Split-Path -Parent $PSScriptRoot
$TaskName = 'DMMS-AutoStart'
$StartupVbs = Join-Path ([Environment]::GetFolderPath('Startup')) 'DMMS-AutoStart.vbs'

schtasks /Delete /TN $TaskName /F 2>$null | Out-Null
if (Test-Path $StartupVbs) {
  Remove-Item $StartupVbs -Force -ErrorAction SilentlyContinue
}

$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($IsAdmin) {
  Remove-NetFirewallRule -DisplayName 'DMMS Frontend LAN (Port 5173)' -ErrorAction SilentlyContinue
}

& (Join-Path $PSScriptRoot 'stop-dmms.ps1')
Write-Host '[DMMS] Auto-start configuration removed and services stopped.' -ForegroundColor Yellow
