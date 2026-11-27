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
// A proxy (Apache under cPanel, nginx, a load balancer) connects from this machine or a private network.
const fromProxy = (addr) => /^(::1|127\.|::ffff:127\.|10\.|::ffff:10\.|192\.168\.|::ffff:192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:172\.(1[6-9]|2\d|3[01])\.|f[cd][0-9a-f]{2}:)/i.test(addr || '');
function clientIp(req) {
  const peer = req.socket.remoteAddress || '';
  if (process.env.CLOUDFLARE === 'true' && req.headers['cf-connecting-ip']) return String(req.headers['cf-connecting-ip']).trim();
  // Forwarded-for headers only count when a proxy sent them: a visitor talking to Node directly could write anything there.
  if (!fromProxy(peer) && !process.env.TRUST_PROXY_HOPS) return peer;
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  // Proxies append to the right; anything further left was sent by the client and can't be trusted.
  if (xff.length) return xff[Math.max(0, xff.length - hops)];
  return peer;
}

function startWorker() {
  process.env.NS_CUSTOM_SERVER = '1'; // tells the app that x-ns-client-ip comes from this file, not from a visitor
  // After a form redirects (sign-in, order tracking), Next.js fetches the next page from this server itself.
  // Without being told the port it assumes localhost:3000, which on a shared host can be someone else's app.
  // Under Passenger (cPanel) the real port isn't known, so it gets an address that refuses at once and Next.js
  // falls back to a normal redirect.
  const numericPort = /^\d+$/.test(String(port)) ? Number(port) : undefined;
  process.env.__NEXT_PRIVATE_ORIGIN = !underPassenger && numericPort ? `http://127.0.0.1:${numericPort}` : 'http://127.0.0.1:1';
  const next = require('next');
  const app = next({ dev: false, dir: __dirname, hostname: '127.0.0.1', port: numericPort });
  const handle = app.getRequestHandler();
  app.prepare().then(() => {
    // .env has been read by now
    const secret = process.env.AUTH_SECRET || '';
    if (!secret || secret.length < 32 || /CHANGE_?ME/i.test(secret)) {
      console.error('WARNING: AUTH_SECRET is missing, too short or still the example value. Admin sign-in and order links will not work. Set your own random 48+ character value in .env and restart.');
    }
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
