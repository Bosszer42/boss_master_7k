'use strict';

function migrateLegacyOwner(user) {
  if (!user) return user;
  if (user.username === 'bosszer42' && user.role === 'owner') {
    return {
      ...user,
      role: 'super_admin',
      passwordHash: user.passwordHash,
      salt: user.salt
    };
  }
  return user;
}

function isSuperAdmin(user) {
  return Boolean(user && user.role === 'super_admin');
}

function canManageUsers(user) {
  return isSuperAdmin(user);
}

function canViewAudit(user) {
  return isSuperAdmin(user);
}

function canCreateUser(actor, payload = {}) {
  if (!actor || !isSuperAdmin(actor)) return false;
  if (payload.selfSignup === true) return false;
  return true;
}

function sanitizeUserForClient(user) {
  if (!user) return null;
  const { passwordHash, salt, password, ...safeUser } = user;
  return safeUser;
}

module.exports = {
  migrateLegacyOwner,
  isSuperAdmin,
  canManageUsers,
  canViewAudit,
  canCreateUser,
  sanitizeUserForClient
};
