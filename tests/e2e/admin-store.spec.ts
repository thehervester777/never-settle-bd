import path from 'path';
import { expect, test } from '@playwright/test';
import { adminPage, newVisitor } from './helpers';
import type { Page } from '@playwright/test';

/** Saves the product form; the editor reloads on ?flash=saved. Reopens the clean URL afterwards. */
async function saveProduct(admin: Page) {
  const url = admin.url().split('?')[0];
  await Promise.all([admin.waitForURL(/flash=saved/), admin.click('button:has-text("Save product")')]);
  await admin.goto(url);
}

/* Admin and store are connected: what the admin changes, shoppers see straight away (not after the cache expires). */

test('a price change in the admin shows in the store at once, and is put back', async ({ browser }) => {
  const { page: admin } = await adminPage(browser);
  const { page: shop } = await newVisitor(browser);
  await admin.goto('/admin/products');
  const link = admin.locator('main a[href^="/admin/products/"]:not([href$="/new"])').first();
  await link.click();
  await admin.waitForURL(/\/admin\/products\/\d+$/);
  const slug = await admin.locator('#slug').inputValue();
  const before = await admin.locator('#price').inputValue();
  const target = String(Number(before) + 7);

  await shop.goto(`/products/${slug}`); // warm the page cache first
  await admin.fill('#price', target);
  await saveProduct(admin);
  await shop.goto(`/products/${slug}`);
  await expect(shop.locator('main')).toContainText(`৳${Number(target).toLocaleString('en-US')}`);

  await admin.fill('#price', before);
  await saveProduct(admin);
  await shop.goto(`/products/${slug}`);
  await expect(shop.locator('main')).toContainText(`৳${Number(before).toLocaleString('en-US')}`);
});

test('new orders reach the admin, and a category with its picture reaches the homepage', async ({ browser }) => {
  const { page: admin, errors } = await adminPage(browser);
  const { page: shop } = await newVisitor(browser);
  const name = `E2E ${Date.now().toString(36)}`;
  const order = await shop.request.post('/api/checkout', { data: { items: [{ variantId: 1, quantity: 1 }], customerName: name, phone: '01811223344', address: 'House 3, Road 9, Agrabad', city: 'Chattogram', zone: 'outside_dhaka' } });
  expect(order.ok(), await order.text()).toBeTruthy();
  await admin.goto('/admin/orders');
  await expect(admin.locator('main')).toContainText(name);

  await shop.goto('/'); // cached homepage
  await admin.goto('/admin/categories');
  await admin.click('button:has-text("Add category")');
  await admin.fill('#c-name', name);
  await admin.locator('[role=dialog] input[type=file]').setInputFiles(path.join(__dirname, 'fixture-category.jpg'));
  await expect(admin.locator('[role=dialog] img[src*="/uploads/category-"]').first()).toBeVisible({ timeout: 15000 });
  await admin.click('[role=dialog] button:has-text("Add category")');
  await expect(admin.locator('main li', { hasText: name })).toBeVisible();
  const src = await admin.locator('main li', { hasText: name }).locator('img').getAttribute('src');

  await shop.goto('/');
  await expect(shop.locator(`#categories a img[src="${src}"]`)).toHaveCount(1);
  expect((await shop.request.get(src!)).ok()).toBeTruthy();

  admin.once('dialog', (d) => d.accept());
  await admin.locator('main li', { hasText: name }).locator('button[aria-label^="Delete"]').click();
  await expect(admin.locator('main li', { hasText: name })).toHaveCount(0);
  await shop.goto('/');
  await expect(shop.locator(`#categories a img[src="${src}"]`)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('product descriptions can not carry scripts into the store', async ({ browser }) => {
  const { page: admin } = await adminPage(browser);
  const { page: shop } = await newVisitor(browser);
  let alerted = false;
  shop.on('dialog', (d) => { alerted = true; d.dismiss(); });
  await admin.goto('/admin/products');
  await admin.locator('main a[href^="/admin/products/"]:not([href$="/new"])').nth(1).click();
  await admin.waitForURL(/\/admin\/products\/\d+$/);
  const slug = await admin.locator('#slug').inputValue();
  const before = await admin.locator('#description').inputValue();
  await admin.fill('#description', `${before}<img src=x onerror="alert(1)"><script>alert(2)</script><p onclick="alert(3)">E2E safe</p>`);
  await saveProduct(admin);
  await shop.goto(`/products/${slug}`);
  await expect(shop.locator('.rte').first()).toContainText('E2E safe');
  const html = await shop.locator('.rte').first().innerHTML();
  expect(html).not.toMatch(/onerror|onclick|<script|<img/i);
  expect(alerted).toBe(false);
  await admin.fill('#description', before);
  await saveProduct(admin);
});
