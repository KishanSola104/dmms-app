const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'frontend', 'dist');
const FRONTEND_HOST = process.env.FRONTEND_HOST || '0.0.0.0';
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT) || 5173;
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT = Number(process.env.BACKEND_PORT || process.env.PORT) || 8000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp'
};

function sendJson(res, statusCode, payload) {
  if (res.headersSent) return;
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function proxyToBackend(req, res) {
  const options = {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${BACKEND_HOST}:${BACKEND_PORT}`,
      'x-forwarded-for': req.socket?.remoteAddress || '',
      'x-forwarded-host': req.headers.host || ''
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    if (!res.headersSent) {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    }
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.setTimeout(120000, () => {
    proxyReq.destroy(new Error('Backend request timeout'));
  });

  proxyReq.on('error', () => {
    if (req.url.startsWith('/api')) {
      sendJson(res, 503, {
        success: false,
        status: 'offline',
        message: 'DMMS is temporarily unavailable. Please wait while the system reconnects.'
      });
    } else if (!res.headersSent) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('DMMS media service temporarily unavailable.');
    }
  });

  req.pipe(proxyReq, { end: true });
}

function serveStaticFile(filePath, res, isHtml = false) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const cacheControl = isHtml
      ? 'no-store, no-cache, must-revalidate'
      : filePath.includes(`${path.sep}assets${path.sep}`)
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const reqUrl = req.url || '/';
  const pathname = decodeURIComponent(reqUrl.split('?')[0]);

  if (pathname === '/__frontend_health') {
    return sendJson(res, 200, {
      success: true,
      status: 'online',
      service: 'dmms-frontend',
      port: FRONTEND_PORT,
      timestamp: new Date().toISOString()
    });
  }

  if (pathname.startsWith('/api') || pathname.startsWith('/uploads')) {
    return proxyToBackend(req, res);
  }

  const indexFile = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexFile)) {
    res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>DMMS frontend build not found</h1><p>Please build frontend/dist.</p>');
    return;
  }

  const safeRelativePath = pathname.replace(/^\/+/, '');
  const candidate = path.resolve(DIST_DIR, safeRelativePath);

  if (
    safeRelativePath &&
    candidate.startsWith(DIST_DIR) &&
    fs.existsSync(candidate) &&
    fs.statSync(candidate).isFile()
  ) {
    return serveStaticFile(candidate, res, candidate.endsWith('.html'));
  }

  // SPA fallback so React Router handles /, /register-school, /school-login, /refresh-app, etc.
  return serveStaticFile(indexFile, res, true);
});

server.listen(FRONTEND_PORT, FRONTEND_HOST, () => {
  console.log(`[DMMS Frontend] Serving production build on http://${FRONTEND_HOST}:${FRONTEND_PORT} -> proxying /api to http://${BACKEND_HOST}:${BACKEND_PORT}`);
});
