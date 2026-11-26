import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base32Decode, base32Encode, hashRecoveryCode, hotp, newRecoveryCodes, newTotpSecret, openSecret, sealSecret, verifyTotp } from '../../src/lib/totp.ts';

// RFC 6238 test key "12345678901234567890" (SHA-1), last 6 digits of the published 8-digit codes.
const RFC_KEY = base32Encode(Buffer.from('12345678901234567890'));

test('matches the RFC 6238 test vectors', () => {
  for (const [time, code] of [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037']] as const) {
    assert.equal(hotp(RFC_KEY, Math.floor(time / 30)), code, `t=${time}`);
  }
});

test('base32 round trip', () => {
  const buf = Buffer.from([0, 1, 2, 250, 255, 128, 7]);
  assert.deepEqual(base32Decode(base32Encode(buf)), buf);
  assert.equal(newTotpSecret().length, 32);
});

test('accepts the current code and one step either side, refuses reuse', () => {
  const key = newTotpSecret();
  const now = 1_800_000_000_000;
  const step = Math.floor(now / 30000);
  assert.equal(verifyTotp(key, hotp(key, step), 0, now), step);
  assert.equal(verifyTotp(key, hotp(key, step - 1), 0, now), step - 1);
  assert.equal(verifyTotp(key, hotp(key, step + 1), 0, now), step + 1);
  assert.equal(verifyTotp(key, hotp(key, step - 2), 0, now), null);
  assert.equal(verifyTotp(key, hotp(key, step), step, now), null, 'same code twice');
  assert.equal(verifyTotp(key, '12345', 0, now), null);
  assert.equal(verifyTotp(key, 'abcdef', 0, now), null);
  assert.equal(verifyTotp(key, hotp(key, step).replace(/(\d{3})/, '$1 '), 0, now), step, 'spaces allowed');
});

test('stored key is encrypted and only opens with the same AUTH_SECRET', () => {
  const key = newTotpSecret();
  const sealed = sealSecret(key, 'a'.repeat(40));
  assert.ok(!sealed.includes(key));
  assert.equal(openSecret(sealed, 'a'.repeat(40)), key);
  assert.equal(openSecret(sealed, 'b'.repeat(40)), null);
  assert.equal(openSecret(sealed.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), 'a'.repeat(40)), null, 'tampered');
});

test('recovery codes are unique and hash the same with or without the dash', () => {
  const codes = newRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const c of codes) assert.match(c, /^[a-z2-7]{5}-[a-z2-7]{5}$/);
  assert.equal(hashRecoveryCode(codes[0]), hashRecoveryCode(codes[0].replace('-', '').toUpperCase()));
});
