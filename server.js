/**
 * Startup file for cPanel "Setup Node.js App" (Phusion Passenger), PM2 or plain `node server.js`.
 * Runs the production Next.js server on the port the host provides.
 *
 * Optional environment variables:
 *   WEB_CONCURRENCY=4      run 4 worker processes on a VPS (one per CPU core). Ignored under Passenger,
 *                          which starts its own processes.
 *   TRUST_PROXY_HOPS=1     how many proxies in front of the app add to X-Forwarded-For (Apache/nginx: 1).
 *   CLOUDFLARE=true        the site is behind Cloudflare: take the visitor's IP from CF-Connecting-IP.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const cluster = require('cluster');
const fs = require('fs');
const path = require('path');
const { createServer } = require('http');

const port = process.env.PORT || '3000';
const underPassenger = typeof PhusionPassenger !== 'undefined';
const workers = underPassenger ? 1 : Math.max(1, parseInt(process.env.WEB_CONCURRENCY || '1', 10) || 1);

/**
 * Store pages are cached (ISR). The copies made while building can hold the build machine's data,
 * so they are discarded at start-up and each page is rebuilt from this server's database on its first visit.
 */
function discardBuildTimePages() {
  const dir = path.join(__dirname, '.next', 'server', 'app');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '.next', 'prerender-manifest.json'), 'utf8')); } catch { return; }
  let n = 0;
  for (const [route, info] of Object.entries(manifest.routes || {})) {
    if (typeof info.initialRevalidateSeconds !== 'number') continue; // truly static (404 page, robots.txt)
    const base = path.join(dir, route === '/' ? 'index' : route.replace(/^\//, ''));
    for (const f of [`${base}.html`, `${base}.rsc`, `${base}.meta`]) { try { fs.rmSync(f); n++; } catch { /* already gone */ } }
    try { fs.rmSync(`${base}.segments`, { recursive: true, force: true }); } catch { /* none */ }
  }
  if (n) console.log(`Discarded ${n} build-time page files; pages are rebuilt from the database on first visit.`);
}

/** The visitor's real IP, set by this server only, so rate limits can't be dodged with a forged header. */
const hops = Math.max(1, parseInt(process.env.TRUST_PROXY_HOPS || '1', 10) || 1);
function clientIp(req) {
  if (process.env.CLOUDFLARE === 'true' && req.headers['cf-connecting-ip']) return String(req.headers['cf-connecting-ip']).trim();
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  // Proxies append to the right; anything further left was sent by the client and can't be trusted.
  if (xff.length) return xff[Math.max(0, xff.length - hops)];
  return req.socket.remoteAddress || '';
}

function startWorker() {
  process.env.NS_CUSTOM_SERVER = '1'; // tells the app that x-ns-client-ip comes from this file, not from a visitor
  const next = require('next');
  const app = next({ dev: false, dir: __dirname });
  const handle = app.getRequestHandler();
  app.prepare().then(() => {
    const server = createServer((req, res) => {
      req.headers['x-ns-client-ip'] = clientIp(req);
      handle(req, res);
    });
    // Longer than the usual proxy idle timeout, so keep-alive connections from Apache/nginx aren't cut mid-request.
    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 66_000;
    server.listen(port, () => console.log(`NEVER SETTLE running on port ${port}${workers > 1 ? ` (worker ${process.pid})` : ''}`));
    const stop = () => server.close(() => process.exit(0));
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
  });
}

if (workers > 1 && cluster.isPrimary) {
  discardBuildTimePages();
  for (let i = 0; i < workers; i++) cluster.fork();
  cluster.on('exit', (w, code) => { if (code !== 0) { console.error(`Worker ${w.process.pid} stopped (${code}); starting another`); cluster.fork(); } });
} else {
  if (!cluster.isWorker) discardBuildTimePages();
  startWorker();
}
