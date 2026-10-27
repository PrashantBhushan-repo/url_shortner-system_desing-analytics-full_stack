import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSocketOrigin } from './apiConfig.js';

test('relative API paths keep Socket.IO on the current origin', () => {
  assert.equal(getSocketOrigin('/api', 'http://localhost:5173'), 'http://localhost:5173');
  assert.equal(getSocketOrigin('/api', 'https://short.company.test'), 'https://short.company.test');
});

test('absolute API URLs select the API origin without its path', () => {
  assert.equal(getSocketOrigin('https://api.company.test/api/', 'https://short.company.test'), 'https://api.company.test');
});
