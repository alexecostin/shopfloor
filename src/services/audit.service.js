import db from '../config/db.js';

export async function logBusinessAction(req, actionType, entityType, entityId, entityName, description, details = {}) {
  try {
    await db('audit.business_actions').insert({
      user_id: req?.user?.userId || null,
      user_email: req?.user?.email || null,
      user_name: req?.user?.fullName || null,
      action_type: actionType,
      entity_type: entityType || null,
      entity_id: entityId || null,
      entity_name: entityName || null,
      description: description || null,
      details: JSON.stringify(details),
      ip_address: req?.ip || req?.connection?.remoteAddress || null,
      user_agent: req?.headers?.['user-agent']?.substring(0, 500) || null,
      tenant_id: req?.user?.tenantId || null,
    });
  } catch (e) {
    // Audit should never break the main flow
    console.error('[AUDIT] Error logging action:', e.message);
  }
}

export async function logChange(tableSchema, tableName, operation, recordId, oldValues, newValues, changedBy, tenantId) {
  try {
    const changedFields = operation === 'UPDATE' && oldValues && newValues
      ? Object.keys(newValues).filter(k => JSON.stringify(oldValues[k]) !== JSON.stringify(newValues[k]))
      : null;

    await db('audit.change_log').insert({
      table_schema: tableSchema,
      table_name: tableName,
      operation,
      record_id: recordId || null,
      old_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null,
      changed_fields: changedFields ? JSON.stringify(changedFields) : null,
      changed_by: changedBy || null,
      tenant_id: tenantId || null,
    });
  } catch (e) {
    console.error('[AUDIT] Error logging change:', e.message);
  }
}

export async function listBusinessActions({ actionType, userId, entityType, entityId, dateFrom, dateTo, tenantId, page = 1, limit = 50 } = {}) {
  let q = db('audit.business_actions');
  if (tenantId) q = q.where('tenant_id', tenantId);
  if (actionType) q = q.where('action_type', actionType);
  if (userId) q = q.where('user_id', userId);
  if (entityType) q = q.where('entity_type', entityType);
  if (entityId) q = q.where('entity_id', entityId);
  if (dateFrom) q = q.where('created_at', '>=', dateFrom);
  if (dateTo) q = q.where('created_at', '<=', dateTo);
  const [{ count }] = await q.clone().count('* as count');
  const data = await q.clone().orderBy('created_at', 'desc').limit(limit).offset((page - 1) * limit);
  return { data, total: Number(count), page, limit };
}

export async function listChanges({ tableSchema, tableName, recordId, changedBy, dateFrom, dateTo, page = 1, limit = 50 } = {}) {
  let q = db('audit.change_log');
  if (tableSchema) q = q.where('table_schema', tableSchema);
  if (tableName) q = q.where('table_name', tableName);
  if (recordId) q = q.where('record_id', recordId);
  if (changedBy) q = q.where('changed_by', changedBy);
  if (dateFrom) q = q.where('changed_at', '>=', dateFrom);
  if (dateTo) q = q.where('changed_at', '<=', dateTo);
  const [{ count }] = await q.clone().count('* as count');
  const data = await q.clone().orderBy('changed_at', 'desc').limit(limit).offset((page - 1) * limit);
  return { data, total: Number(count), page, limit };
}

export async function getEntityHistory(entityType, entityId) {
  const actions = await db('audit.business_actions')
    .where({ entity_type: entityType, entity_id: entityId })
    .orderBy('created_at', 'desc')
    .limit(100);
  return actions;
}

export async function getActionsSummary(tenantId, period = 'week') {
  const daysBack = period === 'month' ? 30 : period === 'quarter' ? 90 : 7;
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();
  const rows = await db('audit.business_actions')
    .where('created_at', '>=', since)
    .modify(q => { if (tenantId) q.where('tenant_id', tenantId); })
    .select(db.raw("DATE(created_at) as day, action_type, COUNT(*) as count"))
    .groupBy('day', 'action_type')
    .orderBy('day');
  return rows;
}
