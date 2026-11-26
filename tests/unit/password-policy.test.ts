import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordIssue } from '../../src/lib/password-policy.ts';

test('password rules', () => {
  assert.equal(passwordIssue('short'), 'short');
  assert.equal(passwordIssue('password123'), 'guess');
  assert.equal(passwordIssue('1234567890'), 'guess');
  assert.equal(passwordIssue('aaaaaaaaaaaa'), 'guess');
  assert.equal(passwordIssue('rahim.uddin-2026', 'rahim.uddin@example.com'), 'email');
  assert.equal(passwordIssue('abababababab'), 'variety');
  assert.equal(passwordIssue('x'.repeat(201)), 'long');
  assert.equal(passwordIssue('mango river bicycle'), null);
  assert.equal(passwordIssue('Tq8#vLp2!mZr', 'owner@shop.com'), null);
});
