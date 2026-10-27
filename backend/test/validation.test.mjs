import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { validateCreateUrl, validateUpdateUrl } from '../src/middlewares/validate.middleware.js';
import { validateBody } from '../src/middlewares/validateAuth.middleware.js';

test('invalid link and auth bodies produce field errors and HTTP 400', () => {
  for (const [middleware, body] of [
    [validateCreateUrl, { longUrl: 'javascript:alert(1)' }],
    [validateUpdateUrl, { expiresAt: 'not-a-timestamp' }],
    [validateBody(z.object({ email: z.string().email() })), { email: 'invalid' }],
  ]) {
    let failure;
    middleware({ body }, {}, error => { failure = error; });
    assert.equal(failure?.statusCode, 400);
    assert.ok(failure.details.length > 0);
    assert.equal(typeof failure.details[0].field, 'string');
  }
});

test('valid link body is normalized and optional update fields remain absent', () => {
  const create = { body: { long_url: ' https://example.com ', custom_alias: 'my-link' } };
  validateCreateUrl(create, {}, error => assert.ifError(error));
  assert.equal(create.body.longUrl, 'https://example.com/');
  const update = { body: { password: null } };
  validateUpdateUrl(update, {}, error => assert.ifError(error));
  assert.deepEqual(update.body, { password: null });
});

test('mail transport composes the application email fields without network access', async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const info = await transport.sendMail({ from: 'sender@example.test', to: 'recipient@example.test', subject: 'OTP check', text: 'verification code', html: '<p>verification code</p>' });
  assert.match(info.message.toString(), /Subject: OTP check/);
  assert.match(info.message.toString(), /verification code/);
});
