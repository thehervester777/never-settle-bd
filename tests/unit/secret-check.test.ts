import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secretProblem } from '../../src/lib/secret-check.ts';

test('AUTH_SECRET must be set, long, and not the example value', () => {
  assert.equal(secretProblem(undefined), 'missing');
  assert.equal(secretProblem('short'), 'too short (needs 32+ characters)');
  assert.equal(secretProblem('CHANGE_ME_TO_A_LONG_RANDOM_STRING'), 'still the example value: replace it');
  assert.equal(secretProblem('paste-a-long-random-string-here-xxxxxxxx'), 'still the example value: replace it');
  assert.equal(secretProblem('9f1c2a7be04d4c5a8e3b6d0f1a2c3e4b5d6f7a8b9c0d1e2f'), null);
});
