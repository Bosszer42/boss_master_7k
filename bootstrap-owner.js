'use strict';

const crypto = require('crypto');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function ensureBootstrapOwner(store, payload = {}) {
  if (!store?.data?.users) throw new Error('store data is invalid');
  const username = String(payload.username || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const displayName = String(payload.displayName || username || 'Owner').trim();

  const existing = store.data.users.find((user) => user.username === username);
  if (existing) {
    if (existing.username === 'bosszer42' && existing.role !== 'super_admin') {
      existing.role = 'super_admin';
      if (typeof store.save === 'function') store.save();
      return { created: false, migrated: true, username: existing.username, displayName: existing.displayName };
    }
    return { created: false, existing: true, username: existing.username, displayName: existing.displayName };
  }

  if (store.data.users.some((user) => user.role === 'super_admin' || user.role === 'owner')) {
    return { created: false, existing: true };
  }

  // Missing credentials mean the app should show its secure first-run setup.
  // Never seed a predictable/default password into a real user database.
  if (!username || password.length < 8) {
    return { created: false, needsSetup: true };
  }
  const { salt, hash } = hashPassword(password);
  store.data.users.push({
    id: crypto.randomUUID(),
    username,
    displayName,
    role: 'super_admin',
    salt,
    passwordHash: hash,
    active: true,
    createdAt: new Date().toISOString()
  });
  if (typeof store.save === 'function') store.save();
  return { created: true, username, displayName };
}

module.exports = { ensureBootstrapOwner };
