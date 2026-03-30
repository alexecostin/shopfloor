import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../../config/db.js';
import { escapeLike } from '../../utils/sanitize.js';

const USERS_TABLE = 'auth.users';

export async function login(email, password) {
  const user = await db(USERS_TABLE).where({ email }).first();

  if (!user) {
    const err = new Error('Email sau parola incorecta.');
    err.statusCode = 401;
    err.code = 'CREDENTIALE_INVALIDE';
    throw err;
  }

  if (!user.is_active) {
    const err = new Error('Contul tau este dezactivat.');
    err.statusCode = 401;
    err.code = 'CONT_DEZACTIVAT';
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const err = new Error('Email sau parola incorecta.');
    err.statusCode = 401;
    err.code = 'CREDENTIALE_INVALIDE';
    throw err;
  }

  const payload = await buildTokenPayload(user);
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRY || '24h' });

  return { token, user: sanitizeUser(user) };
}

export async function register({ email, password, fullName, role, badgeNumber, phone }) {
  const existing = await db(USERS_TABLE).where({ email }).first();
  if (existing) {
    const err = new Error('Exista deja un cont cu acest email.');
    err.statusCode = 409;
    err.code = 'EMAIL_DUPLICAT';
    throw err;
  }

  const password_hash = await bcrypt.hash(password, 10);

  const [user] = await db(USERS_TABLE)
    .insert({
      email,
      password_hash,
      full_name: fullName,
      role,
      badge_number: badgeNumber || null,
      phone: phone || null,
    })
    .returning('*');

  return sanitizeUser(user);
}

export async function getMe(userId) {
  const user = await db(USERS_TABLE).where({ id: userId }).first();
  if (!user) {
    const err = new Error('Utilizatorul nu a fost gasit.');
    err.statusCode = 404;
    err.code = 'USER_NEGASIT';
    throw err;
  }
  return sanitizeUser(user);
}

export async function listUsers({ page = 1, limit = 20, role, isActive, search } = {}) {
  const offset = (page - 1) * limit;
  let query = db(USERS_TABLE);

  if (role) query = query.where({ role });
  if (isActive !== undefined) query = query.where({ is_active: isActive });
  if (search) {
    query = query.where((q) =>
      q.whereILike('full_name', `%${escapeLike(search)}%`).orWhereILike('email', `%${escapeLike(search)}%`)
    );
  }

  const [{ count }] = await query.clone().count('id as count');
  const users = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

  return {
    data: users.map(sanitizeUser),
    pagination: { page, limit, total: Number(count), pages: Math.ceil(count / limit) },
  };
}

export async function updateUser(id, { fullName, role, badgeNumber, phone, isActive }) {
  const user = await db(USERS_TABLE).where({ id }).first();
  if (!user) {
    const err = new Error('Utilizatorul nu a fost gasit.');
    err.statusCode = 404;
    err.code = 'USER_NEGASIT';
    throw err;
  }

  const updates = {};
  if (fullName !== undefined) updates.full_name = fullName;
  if (role !== undefined) updates.role = role;
  if (badgeNumber !== undefined) updates.badge_number = badgeNumber;
  if (phone !== undefined) updates.phone = phone;
  if (isActive !== undefined) updates.is_active = isActive;
  updates.updated_at = new Date();

  const [updated] = await db(USERS_TABLE).where({ id }).update(updates).returning('*');
  return sanitizeUser(updated);
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await db(USERS_TABLE).where({ id: userId }).first();

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    const err = new Error('Parola curenta este incorecta.');
    err.statusCode = 400;
    err.code = 'PAROLA_INCORECTA';
    throw err;
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  await db(USERS_TABLE).where({ id: userId }).update({ password_hash, updated_at: new Date() });
}

async function buildTokenPayload(user) {
  let roles = [], permissions = [], scopes = [], activeModules = [], tenantId = null, tier = 'basic', licenseStatus = 'active';

  try {
    // Get roles
    const userRoles = await db('auth.user_roles as ur')
      .join('auth.roles as r', 'ur.role_id', 'r.id')
      .where('ur.user_id', user.id)
      .select('r.id', 'r.code', 'r.name');
    roles = userRoles.map(r => r.code);

    // Get permissions (union from all roles)
    if (userRoles.length > 0) {
      const perms = await db('auth.role_permissions as rp')
        .join('auth.permissions as p', 'rp.permission_id', 'p.id')
        .whereIn('rp.role_id', userRoles.map(r => r.id))
        .distinct('p.code')
        .select('p.code');
      permissions = perms.map(p => p.code);
    }

    // Get scopes
    const userScopes = await db('auth.user_scopes as us')
      .join('org.units as ou', 'us.org_unit_id', 'ou.id')
      .where('us.user_id', user.id)
      .select('us.org_unit_id', 'ou.name as org_unit_name', 'ou.level', 'us.access_level');
    scopes = userScopes.map(s => ({
      orgUnitId: s.org_unit_id,
      orgUnitName: s.org_unit_name,
      level: s.level,
      accessLevel: s.access_level,
    }));

    // Get tenant from user
    tenantId = user.tenant_id || null;

    if (tenantId) {
      // Active modules
      const mods = await db('system.tenant_modules').where({ tenant_id: tenantId, is_active: true }).select('module_code');
      activeModules = mods.map(m => m.module_code);

      // License
      const license = await db('system.licenses').where('tenant_id', tenantId).orderBy('valid_to', 'desc').first();
      if (license) {
        tier = license.tier;
        const today = new Date();
        const validTo = new Date(license.valid_to);
        if (license.status === 'suspended') {
          licenseStatus = 'suspended';
        } else if (today > validTo) {
          const graceDays = license.grace_period_days || 15;
          const daysPast = (today - validTo) / 86400000;
          licenseStatus = daysPast <= graceDays ? 'grace' : 'expired';
        } else {
          licenseStatus = 'active';
        }
      }
    } else {
      // No tenant (standalone / test mode) — grant full access based on role
      const ALL_MODULES = [
        'auth', 'machines', 'production', 'maintenance', 'checklists',
        'hr_skills', 'inventory', 'import_export', 'reports_advanced', 'alerts',
        'companies', 'bom_mbom', 'tools', 'planning', 'simulation',
        'costs_realtime', 'setup_times', 'costs',
      ];
      if (['admin', 'production_manager'].includes(user.role)) {
        activeModules = ALL_MODULES;
        tier = 'enterprise';
      } else {
        activeModules = ['auth', 'machines', 'production', 'maintenance', 'checklists'];
      }
    }
  } catch (e) {
    // New tables may not exist yet — use legacy role
    if (user.role === 'admin') {
      roles = ['admin'];
      permissions = ['*'];
      activeModules = [
        'auth', 'machines', 'production', 'maintenance', 'checklists',
        'hr_skills', 'inventory', 'import_export', 'reports_advanced', 'alerts',
        'companies', 'bom_mbom', 'tools', 'planning', 'simulation',
        'costs_realtime', 'setup_times',
      ];
    }
  }

  return {
    userId: user.id,
    tenantId,
    email: user.email,
    fullName: user.full_name,
    role: user.role, // legacy
    roles,
    permissions,
    scopes,
    activeModules,
    tier,
    licenseStatus,
  };
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}
