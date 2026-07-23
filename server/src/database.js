'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function openDatabase(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('super_admin','admin','user','viewer')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','disabled','deleted_pending')),
      password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_super_admin ON users(role) WHERE role='super_admin';
    CREATE TABLE IF NOT EXISTS sessions(
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), token_hash TEXT NOT NULL UNIQUE,
      device_id TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS devices(
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', last_seen_at TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feature_definitions(key TEXT PRIMARY KEY, description TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS global_feature_policies(feature_key TEXT PRIMARY KEY, enabled INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS role_feature_policies(role TEXT NOT NULL, feature_key TEXT NOT NULL, enabled INTEGER NOT NULL, PRIMARY KEY(role,feature_key));
    CREATE TABLE IF NOT EXISTS user_feature_overrides(user_id TEXT NOT NULL, feature_key TEXT NOT NULL, enabled INTEGER NOT NULL, PRIMARY KEY(user_id,feature_key));
    CREATE TABLE IF NOT EXISTS device_feature_overrides(device_id TEXT NOT NULL, feature_key TEXT NOT NULL, enabled INTEGER NOT NULL, PRIMARY KEY(device_id,feature_key));
    CREATE TABLE IF NOT EXISTS registration_invites(
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, role TEXT NOT NULL, expires_at TEXT NOT NULL,
      used_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS offline_leases(
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_id TEXT NOT NULL, issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL, payload_json TEXT NOT NULL, revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS lease_revocations(lease_id TEXT PRIMARY KEY, revoked_at TEXT NOT NULL, reason TEXT);
    CREATE TABLE IF NOT EXISTS usage_events(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT, model TEXT, tokens INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS budget_limits(user_id TEXT PRIMARY KEY, daily_tokens INTEGER NOT NULL DEFAULT 0, requests_per_minute INTEGER NOT NULL DEFAULT 30);
    CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id TEXT, event TEXT NOT NULL, target_id TEXT, metadata_json TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ai_provider_configs(provider TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0, config_json TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS app_versions(version TEXT PRIMARY KEY, minimum_supported INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sync_operations(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, operation_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, applied_at TEXT);
    CREATE TABLE IF NOT EXISTS backups(id TEXT PRIMARY KEY, filename TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS system_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  db.prepare("INSERT OR IGNORE INTO system_settings(key,value) VALUES('registration_mode','closed')").run();
  db.prepare("INSERT OR IGNORE INTO system_settings(key,value) VALUES('offline_grace_hours','24')").run();
}

module.exports = { openDatabase, migrate };
