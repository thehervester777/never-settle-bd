import { expect, test } from '@playwright/test';
import { newVisitor } from './helpers';

test('security headers on store and admin pages', async ({ browser }) => {
  const { page } = await newVisitor(browser);
  const home = await page.request.get('/');
  const h = home.headers();
  expect(h['content-security-policy']).toContain("default-src 'self'");
  expect(h['content-security-policy']).toContain("object-src 'none'");
  expect(h['content-security-policy']).toContain("frame-ancestors 'self'");
  expect(h['strict-transport-security']).toMatch(/max-age=\d{7,}/);
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('SAMEORIGIN');
  expect(h['x-powered-by']).toBeUndefined();
  const admin = await page.request.get('/admin/login');
  expect(admin.headers()['cache-control']).toContain('no-store');
  expect(admin.headers()['x-robots-tag']).toContain('noindex');
});

test('closed doors: admin pages, uploads, health details', async ({ browser }) => {
  const { page } = await newVisitor(browser);
  for (const p of ['/admin', '/admin/orders', '/admin/team', '/admin/settings']) {
    const r = await page.request.get(p, { maxRedirects: 0 });
    expect(r.status(), p).toBe(307);
    expect(r.headers().location, p).toContain('/admin/login');
  }
  const up = await page.request.post('/api/admin/upload', { headers: { 'content-type': 'image/jpeg', 'x-upload': 'category' }, data: Buffer.from('xx') });
  expect(up.status()).toBe(403);
  const forged = await page.request.post('/api/admin/upload', { headers: { 'content-type': 'image/jpeg', 'x-upload': '__proto__' }, data: Buffer.from('xx') });
  expect(forged.status()).toBe(400);
  const health = await (await page.request.get('/api/health')).json();
  expect(Object.keys(health)).toEqual(['ok']);
  const setup = await page.request.get('/admin/setup', { maxRedirects: 0 });
  expect(setup.status()).toBe(307); // owner exists: setup is closed
  const traversal = await page.request.get('/uploads/..%2F..%2F.env');
  expect(traversal.status()).toBe(404);
});

test('order tracking is rate limited', async ({ browser }) => {
  const { page } = await newVisitor(browser);
  let limited = false;
  for (let i = 0; i < 10 && !limited; i++) {
    await page.goto('/track');
    await page.fill('#number', `NS-${90000 + i}`);
    await page.fill('#phone', '01712345678');
    await page.click('button:has-text("Find my order")');
    await page.waitForURL(/e=/);
    limited = page.url().includes('e=rate');
  }
  expect(limited).toBe(true);
});
