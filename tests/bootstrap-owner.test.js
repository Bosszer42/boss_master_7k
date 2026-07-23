const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureBootstrapOwner } = require('../bootstrap-owner');

test('creates a seeded super admin account when no users exist', () => {
  const store = { data: { users: [] }, save() {} };
  const result = ensureBootstrapOwner(store, { username: 'bosszer42', password: 'Test-Only-Strong-Password!', displayName: 'Bosszer42' });
  assert.equal(result.created, true);
  assert.equal(store.data.users[0].username, 'bosszer42');
  assert.equal(store.data.users[0].role, 'super_admin');
});

test('does not create a duplicate super admin when users already exist', () => {
  const store = { data: { users: [{ id: '1', username: 'existing', role: 'super_admin' }] }, save() {} };
  const result = ensureBootstrapOwner(store, { username: 'bosszer42', password: 'Test-Only-Strong-Password!' });
  assert.equal(result.created, false);
  assert.equal(store.data.users.length, 1);
});

test('does not seed a predictable account when first-run credentials are missing', () => {
  const store = { data: { users: [] }, save() {} };
  const result = ensureBootstrapOwner(store, { username: 'bosszer42', password: '' });
  assert.equal(result.created, false);
  assert.equal(result.needsSetup, true);
  assert.equal(store.data.users.length, 0);
});
