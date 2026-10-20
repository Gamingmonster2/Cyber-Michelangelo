#!/usr/bin/env node
/**
 * Cyber Michelangelo — zero-dependency static file server.
 * ES modules cannot be loaded from file:// URLs, so the game is served over HTTP.
 *
 * Usage:  node server.mjs            (defaults to http://127.0.0.1:5173)
 *         PORT=8080 node server.mjs
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/** Resolve a request path inside ROOT, or return null when it escapes. */
function resolveSafe(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const rel = decoded.replace(/^\/+/, '');
  const abs = path.resolve(ROOT, rel || 'index.html');
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  return abs;
}

const server = http.createServer(async (req, res) => {
  const started = process.hrtime.bigint();
  let status = 200;
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      status = 405;
      res.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let file = resolveSafe(url.pathname);
    if (!file) {
      status = 403;
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    let info = null;
    try {
      info = await stat(file);
    } catch {
      info = null;
    }
    if (info && info.isDirectory()) {
      file = path.join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info || !info.isFile()) {
      status = 404;
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not Found — ' + url.pathname);
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (err) {
    status = 500;
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
    console.error('[server] error:', err);
  } finally {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    console.log(`${req.method} ${req.url} -> ${status} (${ms.toFixed(1)}ms)`);
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║   CYBER MICHELANGELO · سايبر مايكل أنجلو          ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log(`   Play:  http://${HOST}:${PORT}/`);
  console.log('   Stop:  Ctrl+C');
  console.log('');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}
