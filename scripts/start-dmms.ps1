param(
  [switch]$BuildFrontend,
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Continue'
$RootDir = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $RootDir 'logs'
if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# Ensure MongoDB Windows service is running if installed
try {
  $mongoSvc = Get-Service -Name 'MongoDB' -ErrorAction SilentlyContinue
  if ($mongoSvc -and $mongoSvc.Status -ne 'Running') {
    Write-Host '[DMMS] Starting MongoDB service...'
    Start-Service -Name 'MongoDB' -ErrorAction SilentlyContinue
  }
} catch {}

# Build production frontend bundle if requested or missing
$DistIndex = Join-Path $RootDir 'frontend\dist\index.html'
if ($BuildFrontend -or -not (Test-Path $DistIndex)) {
  Write-Host '[DMMS] Building production frontend...'
  Push-Location (Join-Path $RootDir 'frontend')
  npm run build
  Pop-Location
}

$SupervisorPidFile = Join-Path $LogDir 'supervisor.pid'
$AlreadyRunning = $false
if (Test-Path $SupervisorPidFile) {
  try {
    $SupPid = [int](Get-Content $SupervisorPidFile -Raw).Trim()
    if ($SupPid -gt 0 -and (Get-Process -Id $SupPid -ErrorAction SilentlyContinue)) {
      $AlreadyRunning = $true
      Write-Host "[DMMS] Supervisor is already running (PID $SupPid)."
    }
  } catch {}
}

if (-not $AlreadyRunning) {
  $SupervisorScript = Join-Path $RootDir 'scripts\dmms-supervisor.js'
  Write-Host '[DMMS] Launching DMMS Supervisor in background...'
  Start-Process -FilePath 'node.exe' `
    -ArgumentList "`"$SupervisorScript`"" `
    -WorkingDirectory $RootDir `
    -WindowStyle Hidden | Out-Null
}

# Wait briefly for health endpoint
$Healthy = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/api/health' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) {
      $Healthy = $true
      break
    }
  } catch {}
  Start-Sleep -Milliseconds 750
}

$LocalIps = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notmatch '^127\.|^169\.254\.' } |
  Select-Object -ExpandProperty IPAddress -Unique

Write-Host ''
if ($Healthy) {
  Write-Host '[DMMS] Application is ONLINE and ready.' -ForegroundColor Green
} else {
  Write-Host '[DMMS] Services launched. Please check status in a few seconds.' -ForegroundColor Yellow
}
Write-Host "Local URL:   http://localhost:5173"
Write-Host "Host URL:    http://$($env:COMPUTERNAME):5173"
foreach ($ip in $LocalIps) {
  Write-Host "Network URL: http://${ip}:5173"
}

if ($OpenBrowser) {
  Start-Process 'http://localhost:5173'
}
