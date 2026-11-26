const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const AuditLogService = require('./auditLog.service');

const COOLDOWN_MS = 30 * 1000;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_RESTARTS_IN_WINDOW = 3;

let restartInProgress = false;
let lastRestartAt = 0;
const userRestartTimestamps = new Map();

class RestartService {
  static getStatus() {
    const now = Date.now();
    const cooldownRemainingMs = Math.max(0, COOLDOWN_MS - (now - lastRestartAt));
    return {
      restartInProgress,
      lastRestartAt: lastRestartAt ? new Date(lastRestartAt).toISOString() : null,
      cooldownRemainingSeconds: Math.ceil(cooldownRemainingMs / 1000)
    };
  }

  /**
   * Safely trigger controlled restart of DMMS frontend (port 5173) and backend (port 8000)
   * without exposing arbitrary shell commands or modifying files/DB/env.
   */
  static async requestRestart({ user }) {
    if (!user || !user._id) {
      const err = new Error('Authentication required to restart the application.');
      err.statusCode = 401;
      throw err;
    }

    const now = Date.now();

    if (restartInProgress) {
      const err = new Error('An application restart is already in progress. Please wait for services to reconnect.');
      err.statusCode = 409;
      throw err;
    }

    const sinceLast = now - lastRestartAt;
    if (lastRestartAt > 0 && sinceLast < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - sinceLast) / 1000);
      const err = new Error(`Restart cooldown active. Please wait ${waitSec} second(s) before requesting another restart.`);
      err.statusCode = 429;
      throw err;
    }

    const userKey = user._id.toString();
    const recent = (userRestartTimestamps.get(userKey) || []).filter(ts => now - ts < RATE_WINDOW_MS);
    if (recent.length >= MAX_RESTARTS_IN_WINDOW) {
      const err = new Error('Restart rate limit exceeded. Please wait a few minutes before restarting again.');
      err.statusCode = 429;
      throw err;
    }

    const rootDir = path.resolve(__dirname, '../../../');
    const scriptPath = path.join(rootDir, 'scripts', 'restart-dmms.ps1');

    if (process.platform === 'win32' && !fs.existsSync(scriptPath)) {
      await AuditLogService.log({
        schoolRef: user.schoolRef,
        schoolId: user.schoolId,
        module: 'SYSTEM',
        entityType: 'Application',
        entityId: 'DMMS',
        action: 'APP_RESTART_FAILED',
        details: 'Restart failed: controlled restart script missing.',
        newValue: { status: 'FAILED', reason: 'Restart script missing' },
        user
      });
      const err = new Error('Controlled restart script not found on server.');
      err.statusCode = 500;
      throw err;
    }

    restartInProgress = true;
    lastRestartAt = now;
    recent.push(now);
    userRestartTimestamps.set(userKey, recent);

    await AuditLogService.log({
      schoolRef: user.schoolRef,
      schoolId: user.schoolId,
      module: 'SYSTEM',
      entityType: 'Application',
      entityId: 'DMMS',
      action: 'APP_RESTART_REQUESTED',
      details: `Application restart initiated by ${user.employeeRef?.fullName || user.userId} (${user.roleCode})`,
      newValue: { status: 'INITIATED', frontendPort: 5173, backendPort: process.env.PORT || 8000 },
      user
    });

    if (process.env.NODE_ENV === 'production' && process.env.PM2_HOME) {
      // Production PM2 controlled restart if applicable
      try {
        const child = spawn('pm2', ['reload', 'all'], { detached: true, stdio: 'ignore', shell: false });
        child.unref();
      } catch (e) {
        restartInProgress = false;
        throw e;
      }
    } else if (process.platform === 'win32') {
      try {
        const backendPort = String(process.env.PORT || 8000);
        const child = spawn(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            scriptPath,
            '-BackendPort',
            backendPort,
            '-FrontendPort',
            '5173',
            '-RootDir',
            rootDir
          ],
          {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
          }
        );
        child.unref();
      } catch (spawnErr) {
        restartInProgress = false;
        await AuditLogService.log({
          schoolRef: user.schoolRef,
          schoolId: user.schoolId,
          module: 'SYSTEM',
          entityType: 'Application',
          entityId: 'DMMS',
          action: 'APP_RESTART_FAILED',
          details: `Restart spawn failed: ${spawnErr.message}`,
          newValue: { status: 'FAILED', reason: spawnErr.message },
          user
        });
        throw spawnErr;
      }
    } else {
      // Fallback for non-Windows environments if ever deployed: reset flag after delay
      setTimeout(() => {
        restartInProgress = false;
      }, 5000);
    }

    // Safety timer in case process stays alive (e.g. test mode)
    setTimeout(() => {
      restartInProgress = false;
    }, 15000);

    return {
      success: true,
      status: 'RESTARTING',
      message: 'Application restart initiated for both frontend and backend services. Waiting for services to reconnect...'
    };
  }
}

module.exports = RestartService;
