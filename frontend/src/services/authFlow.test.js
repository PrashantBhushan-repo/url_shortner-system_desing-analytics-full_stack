import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import { authErrorMessage, passwordIsStrong, requireAuthData } from './authFlow.js';
import API from './urlApi.js';

test('authentication errors distinguish network, server and validation failures', () => {
  assert.match(authErrorMessage({}), /Cannot reach/);
  assert.match(authErrorMessage({ response: { status: 503, data: { message: 'Internal server error' } } }), /temporarily unavailable/);
  assert.equal(authErrorMessage({ response: { status: 400, data: { details: [{ message: 'Invalid email' }] } } }), 'Invalid email');
});
test('strong password rules and incomplete session responses are checked', () => {
  assert.equal(passwordIsStrong('weakpassword'), false);
  assert.equal(passwordIsStrong('Test-only!123'), true);
  assert.throws(() => requireAuthData({ data: { data: {} } }, 'accessToken'));
  assert.equal(requireAuthData({ data: { data: { accessToken: 'test' } } }, 'accessToken'), 'test');
});
test('invalid public authentication requests never trigger a session refresh or retry', async () => {
  const original = API.defaults.adapter, oldAxios = axios.defaults.adapter;
  let refreshes = 0, requests = 0;
  axios.defaults.adapter = async () => { refreshes++; throw new Error('Should not refresh'); };
  API.defaults.adapter = async config => { requests++; throw { config, response: { status: 401, data: { message: 'Invalid code' } } }; };
  try {
    for (const path of ['/auth/login', '/auth/verify-login-otp', '/auth/reset-password']) await assert.rejects(API.post(path, {}));
    assert.equal(requests, 3); assert.equal(refreshes, 0);
    assert.equal(API.defaults.baseURL, '/api');
  } finally { API.defaults.adapter = original; axios.defaults.adapter = oldAxios; }
});
