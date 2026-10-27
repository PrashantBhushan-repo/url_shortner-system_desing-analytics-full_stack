import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { publicAuthOptions } from '../src/utils/authOptions.js';
import { verifyLoginOtpSchema } from '../src/validators/auth.validators.js';

const id = '12345678-1234-4234-8234-123456789abc';
let user, failMail = false, delivered = [], verified = false, passwordChanged = false;
const values = new Map();
const redis = {
  get: async key => values.get(key) ?? null,
  set: async (key, value) => values.set(key, value),
  del: async (...keys) => keys.forEach(key => values.delete(key)),
  incr: async key => values.set(key, Number(values.get(key) || 0) + 1),
  expire: async () => {},
};
const repository = Object.fromEntries(['createLoginEvent', 'createRefreshToken', 'createUser', 'findActiveRefreshTokenByHash', 'findRefreshTokenByHash', 'incrementTokenVersion', 'revokeRefreshToken', 'revokeRefreshTokenByHash', 'revokeRefreshTokensByUserId', 'updateUserProfile'].map(key => [key, async () => ({})]));
Object.assign(repository, {
  findUserByEmail: async () => user,
  findUserById: async () => user,
  markEmailVerified: async () => { verified = true; },
  updateUserPassword: async () => { passwordChanged = true; },
});
mock.module('../src/repositories/user.repository.js', { namedExports: repository });
mock.module('../src/config/prismaClient.js', { defaultExport: {} });
mock.module('../src/config/redisClient.js', { namedExports: { getRedisClient: () => redis } });
mock.module('../src/utils/mailer.js', { namedExports: { sendEmail: async message => { if (failMail) throw new Error('SMTP unavailable'); delivered.push(message); } } });
mock.module('../src/services/twoFactor.service.js', { namedExports: { verifyTwoFactorLogin: async () => true } });
mock.module('../src/utils/auth.utils.js', { namedExports: {
  SALT_ROUNDS: 4, createAccessToken: () => 'token', generateOtp: () => '123456', hashOtp: value => `hash:${value}`, hashToken: value => value,
  getRequestMeta: () => ({}), parseRequestMeta: async () => ({}), getJwtSecret: () => 'test-secret',
  toAuthError: (message, statusCode) => Object.assign(new Error(message), { statusCode }),
} });
const auth = await import('../src/services/auth.service.js');
const reset = () => { values.clear(); failMail = false; delivered = []; verified = false; passwordChanged = false; user = { id, email: 'test@example.invalid', emailVerified: false, passwordHash: null }; };

test('public options expose only configured providers and never credentials', () => {
  const options = publicAuthOptions({ baseUrl: 'https://api.example.test', oauth: {
    google: { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://api.example.test/callback' },
    github: { clientId: 'your_client_id', clientSecret: 'placeholder' },
  } });
  assert.deepEqual(options.providers, [{ id: 'google', url: 'https://api.example.test/api/auth/oauth/google' }]);
  assert.equal(JSON.stringify(options).includes('secret'), false);
});

test('resending during cooldown preserves the code already sent', async () => {
  reset();
  await auth.resendOtp({ purpose: 'email_verify', userId: id });
  const original = values.get(`email_verify:${id}`);
  await assert.rejects(auth.resendOtp({ purpose: 'email_verify', userId: id }), error => error.statusCode === 429);
  assert.equal(values.get(`email_verify:${id}`), original);
  await auth.verifyEmailOtp({ userId: id, otp: '123456' });
  assert.equal(verified, true);
});

test('failed mail delivery reports failure and removes unusable challenge', async () => {
  reset(); failMail = true;
  await assert.rejects(auth.resendOtp({ purpose: 'email_verify', userId: id }), error => error.statusCode === 503);
  assert.equal(values.has(`email_verify:${id}`), false);
  assert.equal(values.has(`otp_resend:email_verify:${id}`), false);
});

test('recovery sends a reset email and consumes the code on successful reset', async () => {
  reset();
  const result = await auth.forgotPasswordUser({ email: user.email });
  assert.equal(result.userId, id);
  assert.equal(delivered[0].subject, 'Reset your password');
  await auth.resetPasswordUser({ userId: id, otp: '123456', password: 'Test-only!123' });
  assert.equal(passwordChanged, true);
  await assert.rejects(auth.resetPasswordUser({ userId: id, otp: '123456', password: 'Test-only!123' }));
});

test('OAuth-only accounts return an ordinary credentials error rather than crashing bcrypt', async () => {
  reset(); user.emailVerified = true;
  await assert.rejects(auth.loginUser({ email: user.email, password: 'Test-only!123' }), error => error.statusCode === 401);
});

test('login accepts authenticator and backup-code formats but rejects malformed input', () => {
  for (const otp of ['123456', 'abcdef-123456', 'abcdef123456']) assert.equal(verifyLoginOtpSchema.safeParse({ userId: id, otp }).success, true);
  for (const otp of ['12345', 'letters', 'abcdef-zzzzzz']) assert.equal(verifyLoginOtpSchema.safeParse({ userId: id, otp }).success, false);
});
