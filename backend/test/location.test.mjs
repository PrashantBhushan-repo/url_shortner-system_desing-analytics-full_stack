import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIpAddress, resolveGeoLocation } from '../src/utils/location.js';

test('normalizeIpAddress strips IPv4-mapped IPv6 values', () => {
  assert.equal(normalizeIpAddress('::ffff:127.0.0.1'), '127.0.0.1');
  assert.equal(normalizeIpAddress('  8.8.8.8  '), '8.8.8.8');
  assert.equal(normalizeIpAddress('unknown'), null);
});

test('resolveGeoLocation leaves private and loopback IPs unresolved instead of forcing a city', async () => {
  const geo = await resolveGeoLocation('127.0.0.1');
  assert.equal(geo, null);
});
