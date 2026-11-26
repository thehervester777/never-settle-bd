#!/usr/bin/env node
/**
 * Load test: many visitors browsing the store at once (home, collections, filters, products, search).
 *   npm run test:load -- [base-url] [concurrent-visitors] [seconds]
 *   npm run test:load -- http://localhost:3000 200 20
 * Prints requests per second, response times and errors. No extra packages needed.
 * Run it from a different machine than the server for real numbers: here both share the same CPU.
 * Only test a site you own; on shared hosting, ask your host first.
 */
import http from 'http';
import https from 'https';

const base = (process.argv[2] || process.env.LOAD_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const concurrency = Number(process.argv[3] || 100);
const seconds = Number(process.argv[4] || 15);
const lib = base.startsWith('https') ? https : http;
const agent = new lib.Agent({ keepAlive: true, maxSockets: concurrency });

function get(path, ip) {
  return new Promise((resolve) => {
    const t = process.hrtime.bigint();
    // Each simulated visitor has its own address. The server only believes this header from a proxy on the
    // same machine (a local test); against a remote site all requests come from your one IP, so per-visitor
    // limits (search: 90 a minute) will answer 429, which is shown separately below.
    const req = lib.get(base + path, { agent, headers: { 'user-agent': 'never-settle-load-test', 'accept-encoding': 'gzip', 'x-forwarded-for': ip } }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode, ms: Number(process.hrtime.bigint() - t) / 1e6 }));
    });
    req.on('error', () => resolve({ status: 0, ms: Number(process.hrtime.bigint() - t) / 1e6 }));
    req.setTimeout(30_000, () => req.destroy());
  });
}

async function text(path) {
  return new Promise((resolve, reject) => lib.get(base + path, { agent }, (res) => { let s = ''; res.on('data', (d) => (s += d)); res.on('end', () => resolve(s)); }).on('error', reject));
}

// Pages to visit, from the sitemap
const sitemap = await text('/sitemap.xml').catch(() => '');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const products = urls.filter((u) => u.startsWith('/products/'));
const collections = urls.filter((u) => u.startsWith('/collections/'));
if (!products.length) { console.error(`No products found in ${base}/sitemap.xml — is the store running?`); process.exit(1); }
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const words = ['tee', 'shirt', 'pant', 'punjabi', 'black', 'wallet', 'shoe', 'linen'];
const mix = [
  [30, () => '/'],
  [30, () => pick(products)],
  [20, () => pick(collections.length ? collections : ['/collections/all'])],
  [10, () => `${pick(collections.length ? collections : ['/collections/all'])}/f/sort=${pick(['price-asc', 'price-desc', 'newest'])}`],
  [10, () => `/api/search?q=${pick(words)}`],
];
const total = mix.reduce((n, [w]) => n + w, 0);
const nextPath = () => { let r = Math.random() * total; for (const [w, f] of mix) { if ((r -= w) < 0) return f(); } return '/'; };

console.log(`Load test: ${concurrency} visitors at once for ${seconds}s against ${base} (${products.length} products)`);
const times = [];
const statuses = {};
const end = Date.now() + seconds * 1000;
const started = Date.now();
async function visitor(i) {
  const ip = `10.77.${(i >> 8) & 255}.${i & 255}`;
  while (Date.now() < end) {
    const r = await get(nextPath(), ip);
    times.push(r.ms);
    statuses[r.status] = (statuses[r.status] || 0) + 1;
  }
}
await Promise.all(Array.from({ length: concurrency }, (_, i) => visitor(i)));
const elapsed = (Date.now() - started) / 1000;
times.sort((a, b) => a - b);
const pct = (p) => times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))].toFixed(0);
const ok = Object.entries(statuses).filter(([s]) => (s >= 200 && s < 400) || s === '429').reduce((n, [, c]) => n + c, 0);
const rate = times.length / elapsed;
console.log(`
Requests:        ${times.length} in ${elapsed.toFixed(1)}s  →  ${rate.toFixed(0)} per second
Response time:   median ${pct(50)} ms · 90% under ${pct(90)} ms · 99% under ${pct(99)} ms · slowest ${times[times.length - 1].toFixed(0)} ms
Status codes:    ${Object.entries(statuses).map(([s, c]) => `${s === '0' ? 'failed' : s === '429' ? '429 (rate limited, by design)' : s}: ${c}`).join(' · ')}
Success rate:    ${((ok / times.length) * 100).toFixed(2)}%

What this means: a visitor reading the store requests a page every ~10–30 s, so ${rate.toFixed(0)} pages/s
serves roughly ${Math.round(rate * 10).toLocaleString('en-US')}–${Math.round(rate * 30).toLocaleString('en-US')} people browsing at the same moment from this one server.`);
agent.destroy();
process.exit(ok / times.length >= 0.99 ? 0 : 1);
