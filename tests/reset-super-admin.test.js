'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { resetSuperAdmin } = require('../scripts/reset-super-admin');

test('resets only the super admin password and preserves user data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bossmaster-reset-test-'));
  const databasePath = path.join(dir, 'database.json');
  const original = {
    users: [{ id: 'u1', username: 'bosszer42', role: 'owner', active: true, salt: 'old', passwordHash: 'old-hash' }],
    rooms: [{ id: 'r1', title: 'keep me' }],
    notes: { u1: { content: 'keep this note' } },
    settings: { u1: { apiKeys: { openai: 'encrypted-value' } } }
  };
  fs.writeFileSync(databasePath, JSON.stringify(original), 'utf8');
  resetSuperAdmin({ databasePath, password: 'Test-Only-New-Password!42' });
  const changed = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
  assert.equal(changed.users[0].role, 'super_admin');
  assert.equal(changed.users[0].active, true);
  assert.notEqual(changed.users[0].passwordHash, 'old-hash');
  assert.equal(crypto.scryptSync('Test-Only-New-Password!42', changed.users[0].salt, 64).toString('hex'), changed.users[0].passwordHash);
  assert.deepEqual(changed.rooms, original.rooms);
  assert.deepEqual(changed.notes, original.notes);
  assert.deepEqual(changed.settings, original.settings);
  assert.equal(fs.readdirSync(dir).some((name) => name.endsWith('.bak')), true);
  fs.rmSync(dir, { recursive: true, force: true });
});
