import db from '../config/db.js';

function formatValue(v) {
  return {
    id: v.id,
    code: v.code,
    displayName: v.display_name,
    displayNameEn: v.display_name_en || v.display_name,
    sortOrder: v.sort_order,
    isDefault: v.is_default,
    isActive: v.is_active,
    color: v.color,
    icon: v.icon,
    metadata: v.metadata || {},
  };
}

export async function getValues(tenantId, lookupType, includeInactive = false) {
  // Check if tenant has custom values
  let q = db('system.lookup_values')
    .where({ lookup_type: lookupType });

  if (tenantId) {
    const tenantCount = await db('system.lookup_values')
      .where({ lookup_type: lookupType, tenant_id: tenantId })
      .count('id as n').first();

    if (Number(tenantCount?.n) > 0) {
      q = q.where({ tenant_id: tenantId });
    } else {
      q = q.whereNull('tenant_id');
    }
  } else {
    q = q.whereNull('tenant_id');
  }

  if (!includeInactive) q = q.where({ is_active: true });
  const rows = await q.orderBy('sort_order').orderBy('display_name');
  return rows.map(formatValue);
}

export async function getValue(tenantId, lookupType, code) {
  let v = tenantId
    ? await db('system.lookup_values').where({ lookup_type: lookupType, code, tenant_id: tenantId }).first()
    : null;
  if (!v) v = await db('system.lookup_values').where({ lookup_type: lookupType, code }).whereNull('tenant_id').first();
  return v ? formatValue(v) : null;
}

export async function validateLookupValue(tenantId, lookupType, code) {
  if (!code) return false;
  const v = await getValue(tenantId, lookupType, code);
  return !!(v && v.isActive);
}

export async function initTenantLookups(tenantId) {
  const defaults = await db('system.lookup_values').whereNull('tenant_id');
  const rows = defaults.map(({ id: _id, tenant_id: _t, created_at: _c, ...rest }) => ({
    ...rest,
    tenant_id: tenantId,
  }));
  if (rows.length) {
    await db('system.lookup_values').insert(rows).onConflict(['tenant_id', 'lookup_type', 'code']).ignore();
  }
  return rows.length;
}

export async function getAllTypes() {
  const defs = await db('system.lookup_definitions').orderBy('display_name');
  const counts = await db('system.lookup_values').whereNull('tenant_id').where({ is_active: true })
    .groupBy('lookup_type').select('lookup_type').count('id as n');
  const countMap = Object.fromEntries(counts.map(c => [c.lookup_type, Number(c.n)]));
  return defs.map(d => ({
    lookupType: d.lookup_type,
    displayName: d.display_name,
    displayNameEn: d.display_name_en,
    isSystem: d.is_system,
    allowTenantCustomization: d.allow_tenant_customization,
    count: countMap[d.lookup_type] || 0,
  }));
}

export async function createValue(tenantId, lookupType, data) {
  const [v] = await db('system.lookup_values').insert({
    tenant_id: tenantId,
    lookup_type: lookupType,
    code: data.code,
    display_name: data.displayName,
    display_name_en: data.displayNameEn || null,
    sort_order: data.sortOrder ?? 0,
    is_default: data.isDefault ?? false,
    color: data.color || null,
    icon: data.icon || null,
    metadata: JSON.stringify(data.metadata || {}),
  }).returning('*');
  return formatValue(v);
}

export async function updateValue(tenantId, lookupType, code, data) {
  const updates = {};
  if (data.displayName !== undefined) updates.display_name = data.displayName;
  if (data.displayNameEn !== undefined) updates.display_name_en = data.displayNameEn;
  if (data.sortOrder !== undefined) updates.sort_order = data.sortOrder;
  if (data.isDefault !== undefined) updates.is_default = data.isDefault;
  if (data.color !== undefined) updates.color = data.color;
  if (data.icon !== undefined) updates.icon = data.icon;
  if (data.isActive !== undefined) updates.is_active = data.isActive;
  if (data.metadata !== undefined) updates.metadata = JSON.stringify(data.metadata);

  // Try tenant row first, else update global
  let q = db('system.lookup_values').where({ lookup_type: lookupType, code });
  q = tenantId ? q.where({ tenant_id: tenantId }) : q.whereNull('tenant_id');
  const [v] = await q.update(updates).returning('*');
  return v ? formatValue(v) : null;
}

export async function deactivateValue(tenantId, lookupType, code) {
  return updateValue(tenantId, lookupType, code, { isActive: false });
}

export async function resetToDefaults(tenantId, lookupType) {
  // Delete tenant-specific values and copy from defaults
  await db('system.lookup_values').where({ tenant_id: tenantId, lookup_type: lookupType }).delete();
  const defaults = await db('system.lookup_values').where({ lookup_type: lookupType }).whereNull('tenant_id');
  const rows = defaults.map(({ id: _id, tenant_id: _t, created_at: _c, ...rest }) => ({
    ...rest,
    tenant_id: tenantId,
  }));
  if (rows.length) await db('system.lookup_values').insert(rows);
  return getValues(tenantId, lookupType);
}
