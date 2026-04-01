import db from '../../config/db.js';
import { getTenantConfig } from '../../services/app-config.service.js';

export async function listElements(tenantId) {
  const q = db('costs.cost_element_definitions').orderBy('sort_order');
  if (tenantId) {
    q.where(sub => sub.where({ tenant_id: tenantId }).orWhereNull('tenant_id'));
  } else {
    q.whereNull('tenant_id');
  }
  return q;
}

export async function updateElement(id, data) {
  const updates = {};
  if (data.isActive !== undefined) updates.is_active = data.isActive;
  if (data.elementName !== undefined) updates.element_name = data.elementName;
  const [updated] = await db('costs.cost_element_definitions').where({ id }).update(updates).returning('*');
  return updated;
}

export async function getMachineCostConfig(machineId) {
  return db('costs.machine_cost_config')
    .where({ machine_id: machineId })
    .whereNull('valid_to')
    .orderBy('valid_from', 'desc')
    .first();
}

export async function setMachineCostConfig(machineId, data) {
  const row = {
    machine_id: machineId,
    config_mode: data.configMode || 'simple',
    hourly_rate: data.hourlyRate || null,
    depreciation_hourly: data.depreciationHourly || null,
    energy_hourly: data.energyHourly || null,
    space_hourly: data.spaceHourly || null,
    insurance_hourly: data.insuranceHourly || null,
    other_hourly: data.otherHourly || null,
    power_kw: data.powerKw || null,
    energy_price_per_kwh: data.energyPricePerKwh || null,
    valid_from: data.validFrom || new Date().toISOString().slice(0, 10),
  };
  // Close previous config
  await db('costs.machine_cost_config').where({ machine_id: machineId }).whereNull('valid_to')
    .update({ valid_to: row.valid_from });
  const [inserted] = await db('costs.machine_cost_config').insert(row).onConflict(['machine_id','valid_from']).merge().returning('*');
  return inserted;
}

export function getEffectiveHourlyRate(config) {
  if (!config) return 0;
  if (config.config_mode === 'simple') return parseFloat(config.hourly_rate) || 0;
  const dep = parseFloat(config.depreciation_hourly) || 0;
  const energy = parseFloat(config.energy_hourly) || 0;
  const space = parseFloat(config.space_hourly) || 0;
  const ins = parseFloat(config.insurance_hourly) || 0;
  const other = parseFloat(config.other_hourly) || 0;
  return dep + energy + space + ins + other;
}

export async function listOperatorConfigs(tenantId) {
  return db('costs.operator_cost_config').where({ tenant_id: tenantId });
}

export async function setOperatorConfigs(tenantId, { configType, rates }) {
  // Delete old configs of same type for this tenant
  await db('costs.operator_cost_config').where({ tenant_id: tenantId, config_type: configType }).delete();
  const rows = rates.map(r => ({
    tenant_id: tenantId,
    config_type: configType,
    user_id: configType === 'per_operator' ? r.userId : null,
    skill_level_id: configType === 'per_skill_level' ? r.skillLevelId : null,
    hourly_rate: r.hourlyRate,
    overtime_rate: r.overtimeRate || null,
    valid_from: new Date().toISOString().slice(0, 10),
  }));
  return db('costs.operator_cost_config').insert(rows).returning('*');
}

export async function getOperatorHourlyRate(userId, tenantId) {
  // Try per_operator first
  const perOp = await db('costs.operator_cost_config')
    .where({ tenant_id: tenantId, config_type: 'per_operator', user_id: userId })
    .whereNull('valid_to').first();
  if (perOp) return parseFloat(perOp.hourly_rate);

  // Try per_skill_level
  const userSkill = await db('auth.operator_skills as os')
    .where({ 'os.user_id': userId })
    .orderBy('os.skill_level_id', 'desc').first().catch(() => null);
  if (userSkill) {
    const perSkill = await db('costs.operator_cost_config')
      .where({ tenant_id: tenantId, config_type: 'per_skill_level', skill_level_id: userSkill.skill_level_id })
      .whereNull('valid_to').first().catch(() => null);
    if (perSkill) return parseFloat(perSkill.hourly_rate);
  }
  const opRateConfig = await getTenantConfig(tenantId).catch(() => ({}));
  return opRateConfig.defaultOperatorHourlyRate || 10; // fallback from tenant config
}

export async function listOverhead(tenantId) {
  return db('costs.overhead_config').where({ tenant_id: tenantId });
}

export async function createOverhead(tenantId, data) {
  const [row] = await db('costs.overhead_config').insert({
    tenant_id: tenantId,
    overhead_name: data.overheadName,
    overhead_type: data.overheadType,
    value: data.value,
    is_active: true,
  }).returning('*');
  return row;
}

export async function updateOverhead(id, data) {
  const updates = {};
  if (data.isActive !== undefined) updates.is_active = data.isActive;
  if (data.value !== undefined) updates.value = data.value;
  if (data.overheadName !== undefined) updates.overhead_name = data.overheadName;
  const [updated] = await db('costs.overhead_config').where({ id }).update(updates).returning('*');
  return updated;
}
