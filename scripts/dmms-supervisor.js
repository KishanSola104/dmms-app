const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const LOG_DIR = path.join(ROOT_DIR, 'logs');
const PID_FILE = path.join(LOG_DIR, 'supervisor.pid');
const STATE_FILE = path.join(LOG_DIR, 'dmms-state.json');
const RESTART_REQ_FILE = path.join(LOG_DIR, 'restart.request');
const STOP_REQ_FILE = path.join(LOG_DIR, 'stop.request');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function readBackendEnv() {
  const envFile = path.join(BACKEND_DIR, '.env');
  const result = {};
  if (!fs.existsSync(envFile)) return result;
  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim();
      result[k] = v;
    }
  }
  return result;
}

const backendEnvFile = readBackendEnv();
const BACKEND_PORT = Number(process.env.BACKEND_PORT || backendEnvFile.PORT || 8000);
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 5173);

function isProcessAlive(pid) {
  if (!pid || Number.isNaN(Number(pid))) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

function logSupervisor(msg) {
  const line = `[${new Date().toISOString()}] [SUPERVISOR] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(path.join(LOG_DIR, 'supervisor.log'), line);
  } catch {}
}

function rotateLogIfLarge(filePath, maxBytes = 5 * 1024 * 1024) {
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > maxBytes) {
      const backup = `${filePath}.old`;
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
      fs.renameSync(filePath, backup);
    }
  } catch {}
}

function getLocalIPv4Urls() {
  const urls = [`http://localhost:${FRONTEND_PORT}`];
  try {
    const nets = os.networkInterfaces();
    for (const iface of Object.values(nets)) {
      for (const addr of iface || []) {
        if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
          urls.push(`http://${addr.address}:${FRONTEND_PORT}`);
        }
      }
    }
    urls.push(`http://${os.hostname()}:${FRONTEND_PORT}`);
  } catch {}
  return Array.from(new Set(urls));
}

// Single-instance check
if (fs.existsSync(PID_FILE)) {
  const existingPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
  if (existingPid && existingPid !== process.pid && isProcessAlive(existingPid)) {
    console.log(`[SUPERVISOR] Another DMMS supervisor instance is already running (PID ${existingPid}). Exiting.`);
    process.exit(0);
  }
}

fs.writeFileSync(PID_FILE, String(process.pid));
if (fs.existsSync(STOP_REQ_FILE)) fs.unlinkSync(STOP_REQ_FILE);

let shuttingDown = false;
let restartingAll = false;

const services = {
  backend: {
    name: 'backend',
    child: null,
    restarts: 0,
    lastStartedAt: null,
    consecutiveQuickExits: 0,
    status: 'stopped'
  },
  frontend: {
    name: 'frontend',
    child: null,
    restarts: 0,
    lastStartedAt: null,
    consecutiveQuickExits: 0,
    status: 'stopped'
  }
};

function writeState() {
  const state = {
    supervisorPid: process.pid,
    updatedAt: new Date().toISOString(),
    backendPort: BACKEND_PORT,
    frontendPort: FRONTEND_PORT,
    urls: getLocalIPv4Urls(),
    backend: {
      pid: services.backend.child?.pid || null,
      status: services.backend.status,
      restarts: services.backend.restarts,
      lastStartedAt: services.backend.lastStartedAt
    },
    frontend: {
      pid: services.frontend.child?.pid || null,
      status: services.frontend.status,
      restarts: services.frontend.restarts,
      lastStartedAt: services.frontend.lastStartedAt
    }
  };
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

function ensureFrontendBuild() {
  const distIndex = path.join(FRONTEND_DIR, 'dist', 'index.html');
  if (fs.existsSync(distIndex)) return;
  logSupervisor('frontend/dist not found. Building production frontend bundle...');
  try {
    execSync('npm run build', { cwd: FRONTEND_DIR, stdio: 'inherit', windowsHide: true });
    logSupervisor('Frontend production build completed.');
  } catch (err) {
    logSupervisor(`Frontend build failed: ${err.message}`);
  }
}

function freePortWindows(port) {
  if (process.platform !== 'win32') return;
  try {
    const cmd = `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`;
    const out = execSync(`powershell.exe -NoProfile -NonInteractive -Command "${cmd}"`, {
      encoding: 'utf8',
      windowsHide: true
    }).trim();
    if (!out) return;
    for (const pidStr of out.split(/\r?\n/)) {
      const pid = parseInt(pidStr.trim(), 10);
      if (pid && pid !== process.pid) {
        try {
          process.kill(pid, 'SIGTERM');
        } catch {}
      }
    }
  } catch {}
}

function spawnService(key) {
  if (shuttingDown) return;
  const svc = services[key];
  if (svc.child && isProcessAlive(svc.child.pid)) return;

  const logFile = path.join(LOG_DIR, `${key}.log`);
  rotateLogIfLarge(logFile);
  const outStream = fs.createWriteStream(logFile, { flags: 'a' });

  let command = process.execPath;
  let args = [];
  let cwd = ROOT_DIR;
  let extraEnv = {};

  if (key === 'backend') {
    args = [path.join(BACKEND_DIR, 'src', 'server.js')];
    cwd = BACKEND_DIR;
    extraEnv = {
      NODE_ENV: 'production',
      PORT: String(BACKEND_PORT),
      HOST: '0.0.0.0',
      DMMS_SUPERVISED: 'true'
    };
  } else {
    ensureFrontendBuild();
    args = [path.join(__dirname, 'frontend-server.js')];
    cwd = ROOT_DIR;
    extraEnv = {
      NODE_ENV: 'production',
      FRONTEND_HOST: '0.0.0.0',
      FRONTEND_PORT: String(FRONTEND_PORT),
      BACKEND_HOST: '127.0.0.1',
      BACKEND_PORT: String(BACKEND_PORT)
    };
  }

  svc.lastStartedAt = new Date().toISOString();
  svc.status = 'running';

  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  svc.child = child;
  writeState();
  logSupervisor(`Started ${key} (PID ${child.pid})`);

  child.stdout?.pipe(outStream, { end: false });
  child.stderr?.pipe(outStream, { end: false });

  child.on('exit', (code, signal) => {
    outStream.end();
    const ranMs = svc.lastStartedAt ? Date.now() - new Date(svc.lastStartedAt).getTime() : 0;
    svc.child = null;
    svc.status = 'stopped';
    writeState();

    if (shuttingDown || restartingAll) {
      logSupervisor(`${key} stopped (code=${code}, signal=${signal})`);
      return;
    }

    if (ranMs < 10000) {
      svc.consecutiveQuickExits += 1;
    } else {
      svc.consecutiveQuickExits = 0;
    }

    const delayMs = Math.min(10000, 1500 * Math.pow(1.5, Math.min(svc.consecutiveQuickExits, 4)));
    svc.restarts += 1;
    logSupervisor(`${key} exited unexpectedly (code=${code}, signal=${signal}). Auto-restarting in ${Math.round(delayMs)}ms...`);

    setTimeout(() => {
      if (!shuttingDown && !restartingAll) {
        spawnService(key);
      }
    }, delayMs);
  });
}

function stopChild(key) {
  return new Promise((resolve) => {
    const svc = services[key];
    const child = svc.child;
    if (!child || !isProcessAlive(child.pid)) {
      svc.child = null;
      svc.status = 'stopped';
      return resolve();
    }

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      svc.child = null;
      svc.status = 'stopped';
      resolve();
    };

    child.once('exit', done);
    try {
      child.kill('SIGTERM');
    } catch {
      return done();
    }

    setTimeout(() => {
      if (!settled) {
        try {
          if (process.platform === 'win32') {
            execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore', windowsHide: true });
          } else {
            child.kill('SIGKILL');
          }
        } catch {}
        done();
      }
    }, 3500);
  });
}

async function performControlledRestart() {
  if (restartingAll || shuttingDown) return;
  restartingAll = true;
  logSupervisor('Controlled restart requested for backend and frontend...');

  await Promise.all([stopChild('backend'), stopChild('frontend')]);
  freePortWindows(BACKEND_PORT);
  freePortWindows(FRONTEND_PORT);

  await new Promise((r) => setTimeout(r, 700));
  restartingAll = false;
  services.backend.restarts += 1;
  services.frontend.restarts += 1;
  spawnService('backend');
  spawnService('frontend');
  logSupervisor('Controlled restart completed.');
}

async function shutdownAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  logSupervisor('Shutting down DMMS supervisor and managed services...');
  await Promise.all([stopChild('backend'), stopChild('frontend')]);
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } catch {}
  writeState();
  process.exit(0);
}

process.on('SIGINT', shutdownAll);
process.on('SIGTERM', shutdownAll);

// Control file watcher for controlled restart / graceful stop
setInterval(() => {
  if (shuttingDown) return;
  if (fs.existsSync(STOP_REQ_FILE)) {
    try { fs.unlinkSync(STOP_REQ_FILE); } catch {}
    shutdownAll();
    return;
  }
  if (fs.existsSync(RESTART_REQ_FILE)) {
    try { fs.unlinkSync(RESTART_REQ_FILE); } catch {}
    performControlledRestart();
  }
}, 500);

// Clean up any stale listeners before initial launch
freePortWindows(BACKEND_PORT);
freePortWindows(FRONTEND_PORT);

logSupervisor('Starting DMMS Supervisor...');
logSupervisor(`Accessible URLs: ${getLocalIPv4Urls().join(' | ')}`);
spawnService('backend');
spawnService('frontend');
