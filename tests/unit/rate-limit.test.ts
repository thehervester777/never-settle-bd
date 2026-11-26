import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, rateLimit } from '../../src/lib/rate-limit.ts';

const h = (o: Record<string, string>) => new Headers(o);

test('allows the limit per minute, then refuses', () => {
  const src = h({ 'x-real-ip': '198.51.100.7' });
  for (let i = 0; i < 3; i++) assert.equal(rateLimit(src, 'unit', 3), true);
  assert.equal(rateLimit(src, 'unit', 3), false);
  assert.equal(rateLimit(h({ 'x-real-ip': '198.51.100.8' }), 'unit', 3), true, 'other visitors are not affected');
});

test('the IP set by server.js wins only when server.js is running', () => {
  const src = h({ 'x-ns-client-ip': '203.0.113.1', 'x-forwarded-for': '1.1.1.1, 203.0.113.9' });
  delete process.env.NS_CUSTOM_SERVER;
  assert.equal(clientIp(src), '203.0.113.9', 'without server.js: the address the proxy added');
  process.env.NS_CUSTOM_SERVER = '1';
  assert.equal(clientIp(src), '203.0.113.1');
  delete process.env.NS_CUSTOM_SERVER;
  assert.match(clientIp(h({ 'user-agent': 'x' })), /^ua:/);
});
