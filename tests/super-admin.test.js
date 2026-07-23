const test = require('node:test');
const assert = require('node:assert/strict');
const {
  migrateLegacyOwner,
  canManageUsers,
  canViewAudit,
  canCreateUser,
  sanitizeUserForClient,
  isSuperAdmin
} = require('../security-rules');

test('migrates existing bosszer42 owner to super_admin without changing identity or password hash', () => {
  const user = {
    id: 'user-123',
    username: 'bosszer42',
    role: 'owner',
    displayName: 'Boss',
    passwordHash: 'hash-value',
    salt: 'salt-value'
  };

  const migrated = migrateLegacyOwner(user);

  assert.equal(migrated.role, 'super_admin');
  assert.equal(migrated.id, 'user-123');
  assert.equal(migrated.username, 'bosszer42');
  assert.equal(migrated.passwordHash, 'hash-value');
  assert.equal(migrated.salt, 'salt-value');
});

test('only super_admin can manage users and audit logs', () => {
  assert.equal(canManageUsers({ role: 'super_admin' }), true);
  assert.equal(canManageUsers({ role: 'owner' }), false);
  assert.equal(canManageUsers({ role: 'user' }), false);
  assert.equal(canManageUsers({ role: 'viewer' }), false);

  assert.equal(canViewAudit({ role: 'super_admin' }), true);
  assert.equal(canViewAudit({ role: 'user' }), false);
});

test('public signup and non-super-admin creation are blocked', () => {
  assert.equal(canCreateUser({ role: 'super_admin' }, {}), true);
  assert.equal(canCreateUser({ role: 'super_admin' }, { selfSignup: true }), false);
  assert.equal(canCreateUser({ role: 'user' }, {}), false);
  assert.equal(canCreateUser({ role: 'viewer' }, {}), false);
});

test('sensitive auth fields are removed before exposing user data', () => {
  const user = {
    id: 'user-1',
    username: 'alice',
    role: 'user',
    passwordHash: 'secret-hash',
    salt: 'secret-salt',
    password: 'secret-password'
  };

  const sanitized = sanitizeUserForClient(user);

  assert.equal(sanitized.id, 'user-1');
  assert.equal(sanitized.username, 'alice');
  assert.equal(sanitized.role, 'user');
  assert.equal('passwordHash' in sanitized, false);
  assert.equal('salt' in sanitized, false);
  assert.equal('password' in sanitized, false);
});

test('super_admin detection keeps the legacy bosszer42 account flagged correctly', () => {
  assert.equal(isSuperAdmin({ role: 'super_admin' }), true);
  assert.equal(isSuperAdmin({ role: 'owner' }), false);
  assert.equal(isSuperAdmin({ username: 'bosszer42', role: 'super_admin' }), true);
});
