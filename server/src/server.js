'use strict';

const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const { openDatabase } = require('./database');
const { hashPassword, verifyPassword, randomToken, hashToken, sanitizeUser } = require('./security');

const host = process.env.BOSSMASTER_SERVER_HOST || '127.0.0.1';
const port = Number(process.env.BOSSMASTER_SERVER_PORT || 8787);
const dataDir = process.env.BOSSMASTER_SERVER_DATA || path.join(__dirname, '..', 'data');
const db = openDatabase(path.join(dataDir, 'control.db'));

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY'
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw Object.assign(new Error('request_too_large'), { status: 413 });
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function sessionUser(req) {
  const match = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''));
  if (!match) return null;
  return db.prepare(`
    SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).get(hashToken(match[1]), new Date().toISOString());
}

function requireSuperAdmin(req) {
  const user = sessionUser(req);
  if (!user || user.role !== 'super_admin') throw Object.assign(new Error('forbidden'), { status: 403 });
  return user;
}

function audit(event, actor = null, target = null, metadata = {}) {
  db.prepare('INSERT INTO audit_logs(actor_user_id,event,target_id,metadata_json,created_at) VALUES(?,?,?,?,?)')
    .run(actor?.id || null, event, target, JSON.stringify(metadata), new Date().toISOString());
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, service: 'bossmaster-control-server' });

  if (req.method === 'POST' && url.pathname === '/v1/bootstrap') {
    const existing = db.prepare("SELECT id FROM users WHERE role='super_admin'").get();
    if (existing) return json(res, 409, { error: 'bootstrap_already_completed' });
    const expected = process.env.BOSSMASTER_BOOTSTRAP_TOKEN;
    const provided = String(req.headers['x-bootstrap-token'] || '');
    if (!expected || provided.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
      return json(res, 403, { error: 'invalid_bootstrap_token' });
    }
    const body = await readJson(req);
    const username = String(body.username || '').trim().toLowerCase();
    if (username.length < 3) return json(res, 400, { error: 'invalid_username' });
    const password = hashPassword(body.password);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO users(id,username,display_name,role,status,password_salt,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(id, username, String(body.displayName || username), 'super_admin', 'active', password.salt, password.hash, now, now);
    audit('super_admin_bootstrapped', { id }, id);
    return json(res, 201, { user: { id, username, role: 'super_admin' } });
  }

  if (req.method === 'POST' && url.pathname === '/v1/auth/login') {
    const body = await readJson(req);
    const username = String(body.username || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
    if (!user || user.status !== 'active' || !verifyPassword(body.password, user.password_salt, user.password_hash)) {
      audit('login_failed', null, null, { username });
      return json(res, 401, { error: 'invalid_credentials' });
    }
    const token = randomToken();
    const now = Date.now();
    db.prepare('INSERT INTO sessions(id,user_id,token_hash,device_id,created_at,expires_at) VALUES(?,?,?,?,?,?)')
      .run(crypto.randomUUID(), user.id, hashToken(token), body.deviceId || null, new Date(now).toISOString(), new Date(now + 2 * 60 * 60 * 1000).toISOString());
    audit('login_success', user);
    return json(res, 200, { token, user: sanitizeUser(user), expiresAt: new Date(now + 2 * 60 * 60 * 1000).toISOString() });
  }

  if (req.method === 'GET' && url.pathname === '/v1/me') {
    const user = sessionUser(req);
    return user ? json(res, 200, { user: sanitizeUser(user) }) : json(res, 401, { error: 'unauthorized' });
  }

  if (req.method === 'GET' && url.pathname === '/v1/admin/registration') {
    requireSuperAdmin(req);
    const row = db.prepare("SELECT value FROM system_settings WHERE key='registration_mode'").get();
    return json(res, 200, { mode: row?.value || 'closed' });
  }

  if (req.method === 'PUT' && url.pathname === '/v1/admin/registration') {
    const actor = requireSuperAdmin(req);
    const body = await readJson(req);
    if (!['closed', 'invite_only', 'open'].includes(body.mode)) return json(res, 400, { error: 'invalid_registration_mode' });
    db.prepare("UPDATE system_settings SET value=? WHERE key='registration_mode'").run(body.mode);
    audit('registration_mode_changed', actor, null, { mode: body.mode });
    return json(res, 200, { mode: body.mode });
  }

  return json(res, 404, { error: 'not_found' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    console.error(JSON.stringify({ level: 'error', event: 'request_failed', message: error.message }));
    json(res, error.status || 500, { error: error.status ? error.message : 'internal_error' });
  });
});

if (require.main === module) {
  server.listen(port, host, () => console.log(`BOSSMASTER Control Server listening on http://${host}:${port}`));
}

module.exports = { server, db, route };
