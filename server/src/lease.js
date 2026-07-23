'use strict';

const crypto = require('node:crypto');

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function createSigningKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' })
  };
}

function signLease(payload, privateKey) {
  const body = Buffer.from(stableJson(payload));
  return {
    payload,
    signature: crypto.sign(null, body, privateKey).toString('base64url'),
    algorithm: 'Ed25519'
  };
}

function verifyLease(envelope, publicKey, now = Date.now()) {
  if (!envelope?.payload || envelope.algorithm !== 'Ed25519') return { valid: false, reason: 'invalid_format' };
  const signature = Buffer.from(String(envelope.signature || ''), 'base64url');
  const valid = crypto.verify(null, Buffer.from(stableJson(envelope.payload)), publicKey, signature);
  if (!valid) return { valid: false, reason: 'invalid_signature' };
  if (Date.parse(envelope.payload.expires_at) <= now) return { valid: false, reason: 'expired' };
  return { valid: true, payload: envelope.payload };
}

module.exports = { createSigningKeys, signLease, verifyLease, stableJson };
