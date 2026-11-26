import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bdPhone, checkoutSchema, trackSchema } from '../../src/lib/validation.ts';
import { collectionPath } from '../../src/lib/catalog-shared.ts';
import { formatBDT, toPoisha } from '../../src/lib/money.ts';

test('Bangladeshi mobile numbers', () => {
  assert.equal(bdPhone.parse('01712345678'), '01712345678');
  assert.equal(bdPhone.parse('+8801712345678'), '01712345678');
  assert.equal(bdPhone.parse('017-1234 5678'), '01712345678');
  assert.equal(bdPhone.safeParse('01212345678').success, false);
  assert.equal(bdPhone.safeParse('0171234567').success, false);
});

test('checkout only accepts cash on delivery and sane quantities', () => {
  const base = { items: [{ variantId: 1, quantity: 1 }], customerName: 'Rahim Uddin', phone: '01712345678', address: 'House 1, Road 2, Dhanmondi', city: 'Dhaka', zone: 'inside_dhaka' };
  assert.equal(checkoutSchema.safeParse(base).success, true);
  assert.equal(checkoutSchema.safeParse({ ...base, paymentMethod: 'CARD' }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...base, items: [{ variantId: 1, quantity: 999 }] }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...base, items: [] }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...base, zone: 'mars' }).success, false);
  // Prices from the browser are ignored: the schema has no price field to accept.
  const parsed = checkoutSchema.parse({ ...base, items: [{ variantId: 1, quantity: 1, price: 1 }] });
  assert.equal('price' in parsed.items[0], false);
});

test('order tracking input', () => {
  assert.equal(trackSchema.safeParse({ number: 'ns-10001', phone: '01712345678' }).success, true);
  assert.equal(trackSchema.safeParse({ number: '10001', phone: '01712345678' }).success, false);
});

test('filtered collection links are canonical, so each filter combination is cached once', () => {
  assert.equal(collectionPath('/collections/all', {}), '/collections/all');
  const a = collectionPath('/collections/all', { sort: 'price-asc', sizes: ['XL', 'M'], colors: ['Black'] });
  const b = collectionPath('/collections/all', { colors: ['Black'], sizes: ['M', 'XL'], sort: 'price-asc' });
  assert.equal(a, b);
  assert.match(a, /^\/collections\/all\/f\/sort=price-asc&size=M&size=XL&color=Black$/);
});

test('money', () => {
  assert.equal(formatBDT(123456), '৳1,235');
  assert.equal(toPoisha('99.99'), 9999);
});
