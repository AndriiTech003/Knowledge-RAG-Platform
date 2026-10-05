import { createServer } from 'node:http';
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const here = fileURLToPath(new URL('.', import.meta.url));
const distRoot = resolve(here, '..', 'dist');

function findBrowserDir() {
  if (process.env.DIST_DIR) return resolve(process.env.DIST_DIR);
  if (!existsSync(distRoot)) return null;
  for (const name of readdirSync(distRoot)) {
    const candidate = join(distRoot, name, 'browser');
    if (existsSync(join(candidate, 'index.html'))) return candidate;
  }
  return null;
}

const root = findBrowserDir();
if (!root) {
  console.error('No built app found. Run `npm run build` first.');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 4421);
const host = process.env.HOST ?? '127.0.0.1';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.bcmap': 'application/octet-stream',
  '.ftl': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

function runtimeConfig() {
  const file = join(root, 'config.json');
  const base = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  return {
    ...base,
    ...(process.env.API_URL ? { apiUrl: process.env.API_URL } : {}),
    ...(process.env.OIDC_AUTHORITY ? { authority: process.env.OIDC_AUTHORITY } : {}),
    ...(process.env.OIDC_CLIENT_ID ? { clientId: process.env.OIDC_CLIENT_ID } : {}),
  };
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.map', '.txt', '.ftl']);
const compressed = new Map();

function pickEncoding(req) {
  const accepted = String(req.headers['accept-encoding'] ?? '');
  if (/\bbr\b/.test(accepted)) return 'br';
  if (/\bgzip\b/.test(accepted)) return 'gzip';
  return null;
}

function compressedBody(file, encoding, stats) {
  const key = `${file}:${encoding}:${stats.mtimeMs}`;
  let body = compressed.get(key);
  if (!body) {
    const raw = readFileSync(file);
    body =
      encoding === 'br'
        ? brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 9, [constants.BROTLI_PARAM_SIZE_HINT]: raw.length } })
        : gzipSync(raw, { level: 9 });
    compressed.set(key, body);
  }
  return body;
}

function serveFile(req, res, file, method) {
  const ext = extname(file).toLowerCase();
  const immutable = /\.[a-z0-9_-]{8,}\.(js|css|woff2)$/i.test(file);
  const stats = statSync(file);
  const headers = {
    'content-type': types[ext] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  };
  const encoding = COMPRESSIBLE.has(ext) && stats.size > 1024 ? pickEncoding(req) : null;
  if (encoding) {
    const body = compressedBody(file, encoding, stats);
    res.writeHead(200, { ...headers, 'content-encoding': encoding, vary: 'accept-encoding', 'content-length': body.length });
    return res.end(method === 'HEAD' ? undefined : body);
  }
  res.writeHead(200, { ...headers, 'content-length': stats.size });
  if (method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') return send(res, 405, { allow: 'GET, HEAD' }, 'Method Not Allowed');
  const url = new URL(req.url ?? '/', `http://${host}:${port}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return send(res, 400, {}, 'Bad Request');
  }
  if (pathname === '/config.json') {
    return send(res, 200, { 'content-type': types['.json'], 'cache-control': 'no-store' }, JSON.stringify(runtimeConfig()));
  }
  if (pathname === '/healthz') return send(res, 200, { 'content-type': 'text/plain' }, 'ok');
  const target = normalize(join(root, pathname));
  if (target !== root && !target.startsWith(root + sep)) return send(res, 403, {}, 'Forbidden');
  if (existsSync(target) && statSync(target).isFile()) return serveFile(req, res, target, method);
  if (extname(pathname) && !pathname.endsWith('.html')) return send(res, 404, { 'content-type': 'text/plain' }, 'Not Found');
  return serveFile(req, res, join(root, 'index.html'), method);
});

server.listen(port, host, () => {
  console.log(`kb-web serving ${root} on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
