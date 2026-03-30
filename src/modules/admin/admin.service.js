import db from '../../config/db.js';

// ─── TENANT ───────────────────────────────────────────────────────────────────

export const getCurrentTenant = tenantId => db('system.tenants').where('id', tenantId).first();

export const updateTenant = async (tenantId, data) => {
  const [r] = await db('system.tenants').where('id', tenantId).update({ ...data, updated_at: new Date() }).returning('*');
  return r;
};

export const listTenants = () => db('system.tenants').orderBy('name');

// ─── MODULES ──────────────────────────────────────────────────────────────────

const MODULE_CATALOG = [
  { code: 'auth', name: 'Autentificare & Utilizatori', tier: 'basic', always_included: true },
  { code: 'machines', name: 'Gestiune Utilaje', tier: 'basic', always_included: true },
  { code: 'production', name: 'Raportare Productie', tier: 'basic', always_included: true },
  { code: 'maintenance', name: 'Mentenanta', tier: 'basic', always_included: true },
  { code: 'checklists', name: 'Checklists', tier: 'basic', always_included: true },
  { code: 'hr_skills', name: 'Matrice Competente & Ture', tier: 'professional' },
  { code: 'inventory', name: 'Gestiune Stocuri', tier: 'professional' },
  { code: 'import_export', name: 'Import/Export Inteligent', tier: 'professional' },
  { code: 'reports_advanced', name: 'Rapoarte Avansate P/R/R', tier: 'professional' },
  { code: 'alerts', name: 'Alerte Proactive', tier: 'professional' },
  { code: 'companies', name: 'Gestiune Companii', tier: 'professional' },
  { code: 'bom_mbom', name: 'BOM / MBOM', tier: 'enterprise' },
  { code: 'tools', name: 'Scule & Consumabile', tier: 'enterprise' },
  { code: 'planning', name: 'Motor Planificare', tier: 'enterprise' },
  { code: 'simulation', name: 'Simulare What-if', tier: 'enterprise' },
  { code: 'costs_realtime', name: 'Costuri Real-time', tier: 'enterprise' },
  { code: 'setup_times', name: 'Timpi Setup', tier: 'enterprise' },
];

export const listModules = async tenantId => {
  const active = await db('system.tenant_modules').where({ tenant_id: tenantId });
  const activeMap = {};
  for (const m of active) activeMap[m.module_code] = m;

  return MODULE_CATALOG.map(m => ({
    ...m,
    is_active: !!activeMap[m.code]?.is_active,
    activated_at: activeMap[m.code]?.activated_at || null,
    expires_at: activeMap[m.code]?.expires_at || null,
  }));
};

export const activateModule = async (tenantId, moduleCode) => {
  const [r] = await db('system.tenant_modules')
    .insert({ tenant_id: tenantId, module_code: moduleCode, is_active: true })
    .onConflict(['tenant_id', 'module_code'])
    .merge({ is_active: true, activated_at: new Date() })
    .returning('*');
  return r;
};

export const deactivateModule = async (tenantId, moduleCode) => {
  const [r] = await db('system.tenant_modules')
    .where({ tenant_id: tenantId, module_code: moduleCode })
    .update({ is_active: false })
    .returning('*');
  return r;
};

export const listAvailableModules = tier => {
  const tierOrder = { basic: 0, professional: 1, enterprise: 2 };
  const tenantTierLevel = tierOrder[tier] || 0;
  return MODULE_CATALOG.filter(m => tierOrder[m.tier] <= tenantTierLevel || m.always_included);
};

// ─── LICENSE ──────────────────────────────────────────────────────────────────

export const getLicense = async tenantId => {
  const license = await db('system.licenses').where('tenant_id', tenantId).orderBy('valid_to', 'desc').first();
  if (!license) return null;

  const today = new Date();
  const validTo = new Date(license.valid_to);
  const daysRemaining = Math.ceil((validTo - today) / 86400000);

  const userCount = await db('auth.users').where({ tenant_id: tenantId, is_active: true }).count('* as n').first();
  const factoryCount = await db('org.units').where({ tenant_id: tenantId, unit_type: 'factory', is_active: true }).count('* as n').first();

  return {
    ...license,
    days_remaining: daysRemaining,
    users_used: Number(userCount?.n || 0),
    factories_used: Number(factoryCount?.n || 0),
    is_expired: daysRemaining < 0,
    is_grace: daysRemaining < 0 && daysRemaining >= -(license.grace_period_days || 15),
  };
};

export const getLicenseUsage = async tenantId => {
  const [users, factories] = await Promise.all([
    db('auth.users').where({ tenant_id: tenantId, is_active: true }).count('* as n').first(),
    db('org.units').where({ tenant_id: tenantId, unit_type: 'factory', is_active: true }).count('* as n').first(),
  ]);
  return {
    users_active: Number(users?.n || 0),
    factories_active: Number(factories?.n || 0),
  };
};

// ─── ORG HIERARCHY ────────────────────────────────────────────────────────────

export const getOrgTree = async tenantId => {
  const units = await db('org.units').where({ tenant_id: tenantId }).orderBy(['level', 'sort_order', 'name']);

  // Build tree
  const map = {};
  for (const u of units) map[u.id] = { ...u, children: [] };

  const roots = [];
  for (const u of units) {
    if (u.parent_id && map[u.parent_id]) {
      map[u.parent_id].children.push(map[u.id]);
    } else {
      roots.push(map[u.id]);
    }
  }
  return roots;
};

export const getOrgUnit = async (tenantId, id) => {
  const unit = await db('org.units').where({ tenant_id: tenantId, id }).first();
  if (!unit) return null;
  const children = await db('org.units').where({ tenant_id: tenantId, parent_id: id });
  return { ...unit, children };
};

export const createOrgUnit = async (tenantId, data) => {
  const [r] = await db('org.units').insert({ tenant_id: tenantId, ...data }).returning('*');
  return r;
};

export const updateOrgUnit = async (tenantId, id, data) => {
  const [r] = await db('org.units').where({ tenant_id: tenantId, id }).update(data).returning('*');
  return r;
};

export const deleteOrgUnit = async (tenantId, id) => {
  // Check no data associated
  const hasChildren = await db('org.units').where({ tenant_id: tenantId, parent_id: id }).first();
  if (hasChildren) throw Object.assign(new Error('Unitatea are subunitati. Sterge-le mai intai.'), { statusCode: 409 });
  return db('org.units').where({ tenant_id: tenantId, id }).delete();
};

export const listOrgUnitTypes = tenantId => db('org.unit_type_definitions').where('tenant_id', tenantId).orderBy('level');

export const createOrgUnitType = async (tenantId, data) => {
  const [r] = await db('org.unit_type_definitions').insert({ tenant_id: tenantId, ...data }).returning('*');
  return r;
};

// ─── ROLES ────────────────────────────────────────────────────────────────────

export const listRoles = async tenantId => {
  return db('auth.roles')
    .where(q => q.whereNull('tenant_id').orWhere('tenant_id', tenantId))
    .orderBy('is_predefined', 'desc')
    .orderBy('name');
};

export const getRole = async id => {
  const role = await db('auth.roles').where('id', id).first();
  if (!role) return null;
  const perms = await db('auth.role_permissions as rp')
    .join('auth.permissions as p', 'rp.permission_id', 'p.id')
    .where('rp.role_id', id)
    .select('p.*');
  return { ...role, permissions: perms };
};

export const createRole = async (tenantId, data) => {
  const { permission_ids = [], ...roleData } = data;
  const [role] = await db('auth.roles').insert({ tenant_id: tenantId, ...roleData, is_predefined: false }).returning('*');
  if (permission_ids.length > 0) {
    await db('auth.role_permissions').insert(permission_ids.map(pid => ({ role_id: role.id, permission_id: pid }))).onConflict().ignore();
  }
  return getRole(role.id);
};

export const updateRole = async (id, data) => {
  const { permission_ids, ...roleData } = data;
  const role = await db('auth.roles').where('id', id).first();
  if (role?.is_predefined) throw Object.assign(new Error('Rolurile predefinite nu pot fi modificate.'), { statusCode: 400 });

  if (Object.keys(roleData).length > 0) {
    await db('auth.roles').where('id', id).update(roleData);
  }
  if (permission_ids !== undefined) {
    await db('auth.role_permissions').where('role_id', id).delete();
    if (permission_ids.length > 0) {
      await db('auth.role_permissions').insert(permission_ids.map(pid => ({ role_id: id, permission_id: pid }))).onConflict().ignore();
    }
  }
  return getRole(id);
};

export const deleteRole = async id => {
  const role = await db('auth.roles').where('id', id).first();
  if (role?.is_predefined) throw Object.assign(new Error('Rolurile predefinite nu pot fi sterse.'), { statusCode: 400 });
  return db('auth.roles').where('id', id).delete();
};

export const listPermissions = () => db('auth.permissions').orderBy(['module_code', 'code']);

export const listPermissionsByModule = async () => {
  const perms = await db('auth.permissions').orderBy(['module_code', 'code']);
  const map = {};
  for (const p of perms) {
    if (!map[p.module_code]) map[p.module_code] = [];
    map[p.module_code].push(p);
  }
  return Object.entries(map).map(([module_code, permissions]) => ({ module_code, permissions }));
};

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────

export const setUserRoles = async (userId, roleIds) => {
  await db('auth.user_roles').where('user_id', userId).delete();
  if (roleIds.length > 0) {
    await db('auth.user_roles').insert(roleIds.map(rid => ({ user_id: userId, role_id: rid }))).onConflict().ignore();
  }
  return db('auth.user_roles').where('user_id', userId);
};

export const setUserScopes = async (userId, scopes) => {
  await db('auth.user_scopes').where('user_id', userId).delete();
  if (scopes.length > 0) {
    await db('auth.user_scopes').insert(scopes.map(s => ({ user_id: userId, org_unit_id: s.orgUnitId, access_level: s.accessLevel || 'operate' }))).onConflict().ignore();
  }
  return db('auth.user_scopes').where('user_id', userId);
};

export const getEffectivePermissions = async userId => {
  const userRoles = await db('auth.user_roles').where('user_id', userId).select('role_id');
  if (!userRoles.length) return [];
  const perms = await db('auth.role_permissions as rp')
    .join('auth.permissions as p', 'rp.permission_id', 'p.id')
    .whereIn('rp.role_id', userRoles.map(r => r.role_id))
    .distinct('p.code', 'p.name', 'p.module_code', 'p.category')
    .select('p.*');
  return perms;
};
