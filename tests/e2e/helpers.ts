import { expect, type Browser, type Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@neversettle.test';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || '';

/*
 * Every browser gets its own pretend visitor address (the server trusts X-Forwarded-For from localhost,
 * as it would from a proxy), so the per-visitor rate limits don't trip over each other between tests.
 */
let n = Math.floor(Math.random() * 1e6);
export const visitorIp = () => { n++; return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`; };

export async function newVisitor(browser: Browser) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': visitorIp() } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) errors.push(m.text()); });
  return { ctx, page, errors };
}

export async function signIn(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto('/admin/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith('/admin/login') || u.search.includes('e=')), page.click('button:has-text("Sign in")')]);
}

export async function adminPage(browser: Browser) {
  if (!ADMIN_PASSWORD) throw new Error('Set E2E_ADMIN_PASSWORD (and E2E_ADMIN_EMAIL) to run the admin tests.');
  const v = await newVisitor(browser);
  await signIn(v.page);
  await expect(v.page).toHaveURL(/\/admin$/);
  return v;
}

/* Authenticator codes, as the phone app would make them (RFC 6238). */
import crypto from 'crypto';
const b32 = (s: string) => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, v = 0; const o: number[] = []; for (const c of s.replace(/\s/g, '')) { v = (v << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(o); };
export function totp(key: string, step = Math.floor(Date.now() / 30000)) {
  const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', b32(key)).update(m).digest(); const o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}
/** Waits for the next 30-second code, since each code works only once. */
export const nextCodeWindow = (page: Page) => page.waitForTimeout(30000 - (Date.now() % 30000) + 300);
