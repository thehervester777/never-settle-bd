import { expect, test } from '@playwright/test';
import { newVisitor } from './helpers';

test('shopper browses, opens a product over the shop, and places a cash-on-delivery order', async ({ browser }) => {
  const { page, errors } = await newVisitor(browser);
  await page.goto('/');
  await expect(page.locator('#categories a').first()).toBeVisible();

  await page.goto('/collections/all');
  await page.locator('main a[aria-label][href^="/products/"]').first().click();
  const dialog = page.locator('[role=dialog][aria-label="Product"]');
  await expect(dialog).toBeVisible();

  // First size in stock (every demo product has sizes)
  await expect(dialog.locator('button:has-text("Add to cart")')).toBeVisible();
  await dialog.locator('button.option-pill:not([disabled])').first().click();
  await dialog.locator('button:has-text("Add to cart")').click();
  await expect(dialog.locator('button:has-text("Added to cart")')).toBeVisible();

  await page.goto('/checkout');
  await page.fill('#customerName', 'E2E Shopper');
  await page.fill('#phone', '01712345678');
  await page.fill('#address', 'House 12, Road 5, Dhanmondi');
  await page.fill('#city', 'Dhaka');
  await page.click('button:has-text("Place order")');
  await expect(page).toHaveURL(/\/order\/NS-\d+\?t=[a-f0-9]{24}/, { timeout: 15000 });
  const number = page.url().match(/NS-\d+/)![0];

  // The order page needs its secret link
  const tampered = await page.request.get(`/order/${number}?t=${'0'.repeat(24)}`);
  expect(tampered.status()).toBe(404);

  // Tracking finds it with the phone number
  await page.goto('/track');
  await page.fill('#number', number);
  await page.fill('#phone', '01712345678');
  await page.click('button:has-text("Find my order")');
  await expect(page).toHaveURL(new RegExp(`/order/${number}\\?t=`));
  expect(errors).toEqual([]);
});

test('collection filters have their own cacheable address, and old links redirect', async ({ browser }) => {
  const { page } = await newVisitor(browser);
  const r = await page.request.get('/collections/all?sort=price-asc&utm_source=fb', { maxRedirects: 0 });
  expect(r.status()).toBe(308);
  expect(r.headers().location).toMatch(/\/collections\/all\/f\/sort=price-asc\?utm_source=fb$/);
  const filtered = await page.request.get('/collections/all/f/sort=price-asc');
  expect(filtered.status()).toBe(200);
  expect(filtered.headers()['cache-control']).toMatch(/s-maxage=30/);
});

test('checkout refuses bad input and prices can not come from the browser', async ({ browser }) => {
  const { page } = await newVisitor(browser);
  const bad = await page.request.post('/api/checkout', { data: { items: [], customerName: 'x' } });
  expect(bad.status()).toBe(400);
  const card = await page.request.post('/api/checkout', { data: { items: [{ variantId: 1, quantity: 1 }], customerName: 'Card Payer', phone: '01712345678', address: 'House 1, Road 1, Gulshan', city: 'Dhaka', zone: 'inside_dhaka', paymentMethod: 'CARD' } });
  expect(card.status()).toBe(400);
  const huge = await page.request.post('/api/checkout', { headers: { 'content-type': 'application/json' }, data: '{"x":"' + 'a'.repeat(40_000) + '"}' });
  expect(huge.status()).toBe(413);
});
