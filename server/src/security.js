'use strict';

const crypto = require('node:crypto');

function hashPassword(password, salt = crypto.randomBytes(16)) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Password must contain at least 12 characters');
  }
  const derived = crypto.scryptSync(password, salt, 64);
  return { salt: Buffer.from(salt).toString('base64'), hash: derived.toString('base64') };
}

function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = crypto.scryptSync(String(password || ''), Buffer.from(salt, 'base64'), 64);
    const expected = Buffer.from(expectedHash, 'base64');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch (_) {
    return false;
  }
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, password_salt, ...safe } = user;
  return safe;
}

module.exports = { hashPassword, verifyPassword, randomToken, hashToken, sanitizeUser };
