'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร');
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error('รหัสผ่านต้องมีตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ ตัวเลข และสัญลักษณ์');
  }
}

function resetSuperAdmin({ databasePath, username = 'bosszer42', password }) {
  validatePassword(password);
  const resolved = path.resolve(databasePath);
  if (!fs.existsSync(resolved)) throw new Error('ไม่พบฐานข้อมูล BOSSMASTER');
  const data = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (!Array.isArray(data.users)) throw new Error('ฐานข้อมูลไม่มีรายการผู้ใช้');
  const user = data.users.find((item) => String(item.username || '').toLowerCase() === String(username).toLowerCase());
  if (!user) throw new Error(`ไม่พบบัญชี ${username}`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${resolved}.before-password-reset-${timestamp}.bak`;
  fs.copyFileSync(resolved, backupPath);

  const salt = crypto.randomBytes(16).toString('hex');
  user.salt = salt;
  user.passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  user.role = 'super_admin';
  user.active = true;
  user.passwordChangedAt = new Date().toISOString();

  const tempPath = `${resolved}.reset-tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, resolved);
  return { username: user.username, backupPath };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

if (require.main === module) {
  readStdin()
    .then((payload) => resetSuperAdmin(payload))
    .then((result) => {
      process.stdout.write(JSON.stringify({ ok: true, username: result.username, backupPath: result.backupPath }));
    })
    .catch((error) => {
      process.stderr.write(error.message);
      process.exitCode = 1;
    });
}

module.exports = { resetSuperAdmin, validatePassword };
