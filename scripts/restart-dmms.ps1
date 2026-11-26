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

# Brief wait so the HTTP response finishes sending before stopping the current backend
Start-Sleep -Milliseconds 600

Stop-ProcessOnPort -Port $BackendPort
Stop-ProcessOnPort -Port $FrontendPort
Start-Sleep -Milliseconds 800

$BackendDir = Join-Path $RootDir 'backend'
$FrontendDir = Join-Path $RootDir 'frontend'

# Start Backend using its existing package.json script (preserves .env and DB)
Start-Process -FilePath 'cmd.exe' `
  -ArgumentList '/c', 'npm run dev' `
  -WorkingDirectory $BackendDir `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $LogDir 'backend-restart.log') `
  -RedirectStandardError (Join-Path $LogDir 'backend-restart-err.log') | Out-Null

# Start Frontend using its existing Vite dev script
Start-Process -FilePath 'cmd.exe' `
  -ArgumentList '/c', 'npm run dev' `
  -WorkingDirectory $FrontendDir `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $LogDir 'frontend-restart.log') `
  -RedirectStandardError (Join-Path $LogDir 'frontend-restart-err.log') | Out-Null
