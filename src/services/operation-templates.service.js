import db from '../config/db.js';

export async function listTemplates(tenantId) {
  let q = db('bom.operation_templates').where('is_active', true).orderBy('operation_type', 'asc');
  if (tenantId) q = q.where(b => b.where('tenant_id', tenantId).orWhereNull('tenant_id'));
  return q;
}

export async function createTemplate(data, tenantId) {
  const [tpl] = await db('bom.operation_templates').insert({
    name: data.name,
    operation_type: data.operationType,
    machine_type: data.machineType || null,
    default_cycle_time_seconds: data.cycleTimeSeconds || null,
    default_time_unit: data.timeUnit || 'seconds',
    default_setup_time_minutes: data.setupTimeMinutes || null,
    default_tools_config: JSON.stringify(data.toolsConfig || []),
    default_machine_parameters: JSON.stringify(data.machineParameters || []),
    default_consumables: JSON.stringify(data.consumables || []),
    default_attention_points: JSON.stringify(data.attentionPoints || []),
    default_reject_action: data.rejectAction || 'scrap',
    tenant_id: tenantId,
  }).returning('*');
  return tpl;
}

export async function deleteTemplate(id) {
  return db('bom.operation_templates').where('id', id).delete();
}
