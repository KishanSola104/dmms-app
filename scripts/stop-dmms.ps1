$ErrorActionPreference = 'Continue'
$RootDir = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $RootDir 'logs'
$SupervisorPidFile = Join-Path $LogDir 'supervisor.pid'
$StopReqFile = Join-Path $LogDir 'stop.request'

if (Test-Path $SupervisorPidFile) {
  try {
    $SupPid = [int](Get-Content $SupervisorPidFile -Raw).Trim()
    if ($SupPid -gt 0 -and (Get-Process -Id $SupPid -ErrorAction SilentlyContinue)) {
      Write-Host "[DMMS] Requesting graceful shutdown of supervisor (PID $SupPid)..."
      Set-Content -Path $StopReqFile -Value (Get-Date -Format 'o') -Encoding ASCII
      for ($i = 0; $i -lt 15; $i++) {
        if (-not (Get-Process -Id $SupPid -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 500
      }
      if (Get-Process -Id $SupPid -ErrorAction SilentlyContinue) {
        Stop-Process -Id $SupPid -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {}
}

foreach ($port in @(8000, 5173)) {
  try {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
      $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($p in $pids) {
        if ($p -and $p -ne $PID) {
          $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
          if ($proc -and $proc.ProcessName -match 'node|vite|npm') {
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
          }
        }
      }
    }
  } catch {}
}

Write-Host '[DMMS] Backend and Frontend stopped.' -ForegroundColor Yellow
