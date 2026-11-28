param(
  [int]$BackendPort = 8000,
  [int]$FrontendPort = 5173,
  [string]$RootDir = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Continue'
$LogDir = Join-Path $RootDir 'logs'
if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# Brief wait so the HTTP 202 response finishes sending before stopping the current backend
Start-Sleep -Milliseconds 650

$SupervisorPidFile = Join-Path $LogDir 'supervisor.pid'
$SupervisorAlive = $false

if (Test-Path $SupervisorPidFile) {
  try {
    $SupPid = [int](Get-Content $SupervisorPidFile -Raw).Trim()
    if ($SupPid -gt 0 -and (Get-Process -Id $SupPid -ErrorAction SilentlyContinue)) {
      $SupervisorAlive = $true
    }
  } catch {}
}

if ($SupervisorAlive) {
  # Trigger supervisor-managed controlled restart of both backend and frontend
  $RestartReqFile = Join-Path $LogDir 'restart.request'
  Set-Content -Path $RestartReqFile -Value (Get-Date -Format 'o') -Encoding ASCII
  exit 0
}

function Stop-ProcessOnPort([int]$Port) {
  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
      $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($procId in $pids) {
        if ($procId -and $procId -ne $PID) {
          $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
          if ($proc -and $proc.ProcessName -match 'node|vite|npm') {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
          }
        }
      }
    }
  } catch {}
}

Stop-ProcessOnPort -Port $BackendPort
Stop-ProcessOnPort -Port $FrontendPort
Start-Sleep -Milliseconds 800

$DistIndex = Join-Path $RootDir 'frontend\dist\index.html'
$SupervisorScript = Join-Path $RootDir 'scripts\dmms-supervisor.js'

if ((Test-Path $DistIndex) -and (Test-Path $SupervisorScript)) {
  Start-Process -FilePath 'node.exe' `
    -ArgumentList "`"$SupervisorScript`"" `
    -WorkingDirectory $RootDir `
    -WindowStyle Hidden | Out-Null
} else {
  $BackendDir = Join-Path $RootDir 'backend'
  $FrontendDir = Join-Path $RootDir 'frontend'

  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', 'npm run dev' `
    -WorkingDirectory $BackendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $LogDir 'backend-restart.log') `
    -RedirectStandardError (Join-Path $LogDir 'backend-restart-err.log') | Out-Null

  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', 'npm run dev' `
    -WorkingDirectory $FrontendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $LogDir 'frontend-restart.log') `
    -RedirectStandardError (Join-Path $LogDir 'frontend-restart-err.log') | Out-Null
}
