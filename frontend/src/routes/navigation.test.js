import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADMIN_SECTIONS, SETTINGS_ROUTES, legacySettingsLocation, routeTitle, safeReturnTo, settingsPath, signInPath, linkView, updateLinkView } from './navigation.js';

test('legacy settings links preserve their destination and non-navigation query values', () => {
  assert.equal(legacySettingsLocation('?tab=subscription&coupon=SAVE'), '/billing?coupon=SAVE');
  assert.equal(legacySettingsLocation('?tab=twoFactor'), '/settings/two-factor');
  assert.equal(legacySettingsLocation('?tab=apiKeys'), '/settings/api-keys');
  assert.equal(legacySettingsLocation('', 'subscription'), '/billing');
  assert.equal(legacySettingsLocation('?tab=unknown'), '/settings/profile');
  assert.equal(settingsPath('teams'), '/settings/team');
  for (const tab of ['billing', 'subscription', 'refund', 'refunds']) assert.equal(settingsPath(tab), '/billing');
  assert.equal(SETTINGS_ROUTES.some(route => route.slug === 'billing'), false);
  assert.equal(routeTitle('/billing'), 'Plans & billing | PBUrls');
});
test('return destinations preserve valid deep links, filters and anchors', () => {
  for (const value of ['/billing?coupon=SAVE#history', '/analytics/123?range=30d', '/settings/billing#history', '/pricing?plan=pro&cycle=YEARLY', '/admin/reconcile']) assert.equal(safeReturnTo(value), value);
  const query = new URL(signInPath('/settings/security'), 'https://pburls.invalid').searchParams;
  assert.equal(query.get('next'), '/settings/security');
});
test('external URLs, login loops, malformed paths and unknown destinations cannot redirect sign-in', () => {
  for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', '/%2f%2fevil.example', '/settings/../../auth', '/auth?next=/auth', '/oauth/callback?token=anything', '/not-a-page', '/admin/unknown', '/dashboard\n', '/analytics/0', '/analytics/abc', 'javascript:alert(1)', undefined, null]) assert.equal(safeReturnTo(value), '/dashboard', String(value));
});
test('every settings and administration section has a valid title and safe destination', () => {
  for (const route of SETTINGS_ROUTES) {
    assert.equal(safeReturnTo('/settings/' + route.slug), '/settings/' + route.slug);
    assert.equal(routeTitle('/settings/' + route.slug), route.label + ' | PBUrls');
  }
  for (const section of ADMIN_SECTIONS) assert.equal(safeReturnTo('/admin/' + section), '/admin/' + section);
  assert.match(routeTitle('/missing'), /not found/i);
});

test('link view URLs validate values and preserve filters while resetting pagination', () => {
  assert.deepEqual(linkView('?q=launch&status=Expired&sort=clicks&page=3&create=1'), { query:'launch',status:'Expired',sort:'clicks',page:3,showCreate:true });
  assert.deepEqual(linkView('?status=bad&sort=bad&page=-2'), { query:'',status:'All',sort:'newest',page:1,showCreate:false });
  const changed = updateLinkView('?q=launch&page=3&sort=clicks', {status:'Active',page:1});
  assert.equal(changed.get('q'),'launch'); assert.equal(changed.get('sort'),'clicks'); assert.equal(changed.has('page'),false);
  assert.equal(linkView('?page=1e100').page,100000);
});
