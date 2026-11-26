import { expect, test } from '@playwright/test';
import { ADMIN_PASSWORD, adminPage, newVisitor, nextCodeWindow, signIn, totp } from './helpers';

test.describe.configure({ mode: 'serial' });

test('wrong passwords lock the account; an owner reset unlocks it', async ({ browser }) => {
  const { page: owner } = await adminPage(browser);
  const email = `lock-${Date.now().toString(36)}@e2e.test`;
  const password = 'Pale-orange-kite-42';
  await owner.goto('/admin/team');
  await owner.click('button:has-text("Add team member")');
  await owner.fill('#m-name', 'Lock Test');
  await owner.fill('#m-email', email);
  await owner.fill('[role=dialog] #pw', password);
  await owner.click('[role=dialog] button:has-text("Add member")');
  await expect(owner.locator('main')).toContainText(email);

  const v = await newVisitor(browser);
  for (let i = 0; i < 5; i++) await signIn(v.page, email, `wrong-password-${i}`);
  const again = await newVisitor(browser);
  await signIn(again.page, email, password);
  await expect(again.page).toHaveURL(/e=locked/);
  await expect(again.page.locator('p[role=alert]')).toContainText('locked');

  await owner.goto('/admin/team');
  const card = owner.locator('.admin-card', { hasText: email });
  await expect(card).toContainText('Locked');
  await card.locator('button:has-text("Reset password")').click();
  const newPw = await owner.locator('[role=dialog] #pw').inputValue();
  await owner.locator('[role=dialog] button:not([type=button])').last().click();
  await expect(owner.getByText(/Password reset/).first()).toBeVisible();
  const third = await newVisitor(browser);
  await signIn(third.page, email, newPw);
  await expect(third.page).toHaveURL(/\/admin$/);
});

test('two-step sign-in: set up, sign in with a code and a recovery code, turn off', async ({ browser }) => {
  test.setTimeout(150_000);
  const { page } = await adminPage(browser);
  await page.goto('/admin/account');
  await page.click('button:has-text("Turn on two-step sign-in")');
  await expect(page.locator('[data-totp-key]')).toBeVisible();
  const key = (await page.locator('[data-totp-key]').innerText()).replace(/\s/g, '');
  await page.fill('#totp-confirm', totp(key));
  await page.click('button:has-text("Turn on")');
  await expect(page.locator('[data-recovery-codes] li')).toHaveCount(10);
  const codes = await page.locator('[data-recovery-codes] li').allInnerTexts();
  await page.click('button:has-text("I’ve saved them")');

  try {
    const a = await newVisitor(browser);
    await signIn(a.page);
    await expect(a.page).toHaveURL(/\/admin\/login\/verify$/);
    expect((await a.page.request.get('/admin/orders', { maxRedirects: 0 })).status()).toBe(307);
    await a.page.fill('#code', '000000');
    await a.page.click('button:has-text("Verify")');
    await expect(a.page).toHaveURL(/e=code/);
    await a.page.fill('#code', codes[0]);
    await a.page.click('button:has-text("Verify")');
    await expect(a.page).toHaveURL(/\/admin$/);

    const b = await newVisitor(browser);
    await signIn(b.page);
    await b.page.fill('#code', codes[0]);
    await b.page.click('button:has-text("Verify")');
    await expect(b.page).toHaveURL(/e=code/); // used once already
    await nextCodeWindow(b.page);
    await b.page.fill('#code', totp(key));
    await b.page.click('button:has-text("Verify")');
    await expect(b.page).toHaveURL(/\/admin$/);
  } finally {
    // Always leave the owner account as it was
    await nextCodeWindow(page);
    await page.goto('/admin/account');
    await page.click('button:has-text("Turn off")');
    await page.fill('#tf-pw', ADMIN_PASSWORD);
    await page.fill('#tf-code', totp(key));
    await page.locator('form button:has-text("Turn off")').click();
    await expect(page.locator('main')).toContainText('Anyone with your password can sign in');
  }
});
