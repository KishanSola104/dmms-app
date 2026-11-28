$ErrorActionPreference = 'Continue'
$RootDir = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $RootDir 'logs'
$StateFile = Join-Path $LogDir 'dmms-state.json'

Write-Host '=== DMMS Local Server Status ===' -ForegroundColor Cyan

# MongoDB status
$mongo = Get-Service -Name 'MongoDB' -ErrorAction SilentlyContinue
if ($mongo) {
  Write-Host "MongoDB Service: $($mongo.Status) (StartType: $($mongo.StartType))"
} else {
  Write-Host 'MongoDB Service: Not found by name "MongoDB"'
}

# Ports
foreach ($item in @(@{Name='Backend'; Port=8000}, @{Name='Frontend'; Port=5173})) {
  $conn = Get-NetTCPConnection -LocalPort $item.Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    Write-Host "$($item.Name) (Port $($item.Port)): LISTENING (PID $($conn.OwningProcess))" -ForegroundColor Green
  } else {
    Write-Host "$($item.Name) (Port $($item.Port)): NOT LISTENING" -ForegroundColor Red
  }
}

# Health endpoint
try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5173/api/health' -TimeoutSec 3 -ErrorAction Stop
  Write-Host "API Health: $($health.status) | DB: $($health.database)" -ForegroundColor Green
} catch {
  Write-Host 'API Health: UNAVAILABLE' -ForegroundColor Red
}

if (Test-Path $StateFile) {
  Write-Host "`nSupervisor State:"
  Get-Content $StateFile
}
