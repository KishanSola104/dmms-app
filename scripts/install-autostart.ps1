$ErrorActionPreference = 'Stop'
$RootDir = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $RootDir 'logs'
if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$NodePath = (Get-Command node.exe -ErrorAction Stop).Source
$SupervisorScript = Join-Path $RootDir 'scripts\dmms-supervisor.js'
$VbsLauncher = Join-Path $RootDir 'scripts\launch-dmms-hidden.vbs'
$StartupFolder = [Environment]::GetFolderPath('Startup')
$StartupVbs = Join-Path $StartupFolder 'DMMS-AutoStart.vbs'

# Create silent VBS launcher (zero visible terminal window)
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$RootDir"
WshShell.Run """$NodePath"" ""$SupervisorScript""", 0, False
"@
Set-Content -Path $VbsLauncher -Value $vbsContent -Encoding ASCII

$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$TaskName = 'DMMS-AutoStart'

# Remove existing task if present
schtasks /Delete /TN $TaskName /F 2>$null | Out-Null

if ($IsAdmin) {
  Write-Host '[DMMS] Administrator privileges detected. Installing system-boot Scheduled Task & Firewall rule...' -ForegroundColor Cyan

  $Action = New-ScheduledTaskAction -Execute $NodePath -Argument "`"$SupervisorScript`"" -WorkingDirectory $RootDir
  $Trigger = New-ScheduledTaskTrigger -AtStartup
  $Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

  Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
  Write-Host "[DMMS] Scheduled Task '$TaskName' registered (AtStartup / SYSTEM)." -ForegroundColor Green

  # Configure Windows Firewall: allow TCP 5173 on Private & Domain networks; keep MongoDB 27017 local-only
  try {
    Remove-NetFirewallRule -DisplayName 'DMMS Frontend LAN (Port 5173)' -ErrorAction SilentlyContinue
    New-NetFirewallRule `
      -DisplayName 'DMMS Frontend LAN (Port 5173)' `
      -Direction Inbound `
      -Protocol TCP `
      -LocalPort 5173 `
      -Profile Private,Domain `
      -Action Allow | Out-Null
    Write-Host '[DMMS] Windows Firewall rule configured for TCP Port 5173 (Private/Domain LAN only).' -ForegroundColor Green
  } catch {
    Write-Warning "Could not configure Windows Firewall rule: $($_.Exception.Message)"
  }
} else {
  Write-Host '[DMMS] Standard user session detected. Installing AtLogon Scheduled Task & Startup launcher...' -ForegroundColor Yellow

  # Copy silent VBS launcher to Windows Startup folder
  Copy-Item -Path $VbsLauncher -Destination $StartupVbs -Force

  # Also register AtLogon Scheduled Task for current user
  $CurrentUser = "$($env:USERDOMAIN)\$($env:USERNAME)"
  $Action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$VbsLauncher`"" -WorkingDirectory $RootDir
  $Trigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUser
  $Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

  Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Force | Out-Null
  Write-Host "[DMMS] Scheduled Task '$TaskName' (AtLogOn) and Startup folder launcher installed." -ForegroundColor Green
  Write-Host '[DMMS] Tip: Right-click scripts\install-autostart.bat and "Run as administrator" to enable pre-login startup and Windows Firewall port 5173.' -ForegroundColor Cyan
}

# Build & start DMMS now
& (Join-Path $PSScriptRoot 'start-dmms.ps1') -BuildFrontend
