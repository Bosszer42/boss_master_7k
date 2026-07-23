'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, randomToken, hashToken, sanitizeUser } = require('../src/security');
const { createSigningKeys, signLease, verifyLease } = require('../src/lease');

test('passwords and opaque tokens are not stored in plaintext', () => {
  const password = 'Test-Only-Strong-Password!';
  const stored = hashPassword(password);
  assert.equal(verifyPassword(password, stored.salt, stored.hash), true);
  assert.equal(verifyPassword('wrong-password', stored.salt, stored.hash), false);
  const token = randomToken();
  assert.notEqual(hashToken(token), token);
});

test('sensitive user fields are removed', () => {
  const safe = sanitizeUser({ id: 'u1', username: 'test', password_hash: 'x', password_salt: 'y' });
  assert.deepEqual(safe, { id: 'u1', username: 'test' });
});

test('offline lease detects tampering and expiry', () => {
  const keys = createSigningKeys();
  const payload = { lease_id: 'l1', user_id: 'u1', expires_at: new Date(Date.now() + 60_000).toISOString(), feature_flags: { chat: true } };
  const lease = signLease(payload, keys.privateKey);
  assert.equal(verifyLease(lease, keys.publicKey).valid, true);
  lease.payload.feature_flags.chat = false;
  assert.equal(verifyLease(lease, keys.publicKey).reason, 'invalid_signature');
  const expired = signLease({ ...payload, expires_at: new Date(Date.now() - 1000).toISOString() }, keys.privateKey);
  assert.equal(verifyLease(expired, keys.publicKey).reason, 'expired');
});
