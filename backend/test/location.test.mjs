import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createLocationResolver, isPublicIpAddress, normalizeIpAddress, resolveGeoLocation } from '../src/utils/location.js';
mock.module('../src/config/prismaClient.js', { defaultExport: {} });
const { locationQuery } = await import('../src/services/locationAnalytics.service.js');

test('normalizeIpAddress strips IPv4-mapped IPv6 values', () => {
  assert.equal(normalizeIpAddress('::ffff:127.0.0.1'), '127.0.0.1');
  assert.equal(normalizeIpAddress('  8.8.8.8  '), '8.8.8.8');
  assert.equal(normalizeIpAddress('unknown'), null);
});

test('resolveGeoLocation leaves private and loopback IPs unresolved instead of forcing a city', async () => {
  const geo = await resolveGeoLocation('127.0.0.1');
  assert.equal(geo, null);
});

test('normalizes IPv4-mapped addresses and rejects malformed input', () => {
  assert.equal(normalizeIpAddress(' ::ffff:8.8.8.8 '), '8.8.8.8');
  assert.equal(normalizeIpAddress('::ffff:808:808'), '8.8.8.8');
  assert.equal(normalizeIpAddress('8.8.8.8, 1.1.1.1'), null);
  assert.equal(normalizeIpAddress('not-an-ip'), null);
});
test('private, local, reserved and documentation addresses are never geolocated', async () => {
  let calls = 0;
  const resolve = createLocationResolver(() => { calls++; return { city: 'Invented' }; });
  for (const ip of ['127.0.0.2', '::1', '::ffff:192.168.0.2', '::ffff:a00:1', '10.0.0.1', '100.64.0.1', '172.31.0.1', '169.254.1.2', '192.0.2.1', '203.0.113.9', 'fc00::1', 'fe80::1', '2001:db8::1']) {
    assert.equal(isPublicIpAddress(ip), false, ip);
    assert.equal(await resolve(ip), null, ip);
  }
  assert.equal(calls, 0);
  assert.equal(isPublicIpAddress('8.8.8.8'), true);
  assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true);
});
test('GeoIP LRU cache is bounded, expires, caches misses and preserves zero coordinates', async () => {
  let calls = 0, now = 0;
  const resolve = createLocationResolver(ip => { calls++; return ip === '8.8.4.4' ? null : { country: 'US', city: 'Sample', ll: [0, 0] }; }, { maxEntries: 2, ttl: 100, now: () => now });
  assert.deepEqual((await resolve('8.8.8.8')).ll, [0, 0]);
  await resolve('8.8.8.8'); assert.equal(calls, 1);
  await resolve('8.8.4.4'); await resolve('8.8.4.4'); assert.equal(calls, 2);
  await resolve('1.1.1.1'); await resolve('8.8.8.8'); assert.equal(calls, 4);
  now = 101; await resolve('8.8.8.8'); assert.equal(calls, 5);
});
test('location pagination, ranges and exact city identity are validated', () => {
  assert.equal(locationQuery({ page: '2', search: ' Pune ' }).search, 'Pune');
  for (const query of [{ page: '-1' }, { page: '1.5' }, { page: ['1'] }, { search: ['Pune'] }, { country: '' }, { range: 'forever' }]) assert.throws(() => locationQuery(query), error => error.statusCode === 400);
  assert.throws(() => locationQuery({ country: 'US', city: 'Springfield' }, true));
  assert.equal(locationQuery({ country: 'US', state: 'IL', city: 'Springfield' }, true).state, 'IL');
});
