import db from '../../config/db.js';
import { applyScopeFilter } from '../../middleware/scopeFilter.js';
import { escapeLike } from '../../utils/sanitize.js';

const TABLE = 'machines.machines';
const OPERATORS_TABLE = 'machines.machine_operators';

function extractTenant(req) {
  return {
    tenant_id: req?.tenantFilter?.tenantId || null,
    org_unit_id: req?.user?.scopes?.[0]?.orgUnitId || null,
  };
}

export async function listMachines({ status, type, search, page = 1, limit = 50 } = {}, req = null) {
  const offset = (page - 1) * limit;
  let query = db(TABLE);
  applyScopeFilter(query, req);

  if (status) query = query.where({ status });
  if (type) query = query.where({ type });
  if (search) {
    query = query.where((q) =>
      q.whereILike('name', `%${escapeLike(search)}%`).orWhereILike('code', `%${escapeLike(search)}%`)
    );
  }

  const [{ count }] = await query.clone().count('id as count');
  const machines = await query.orderBy('code', 'asc').limit(limit).offset(offset);

  return {
    data: machines,
    pagination: { page, limit, total: Number(count), pages: Math.ceil(count / limit) },
  };
}

export async function getMachine(id) {
  const machine = await db(TABLE).where({ id }).first();
  if (!machine) {
    const err = new Error('Utilajul nu a fost gasit.');
    err.statusCode = 404;
    err.code = 'UTILAJ_NEGASIT';
    throw err;
  }

  const operators = await db(OPERATORS_TABLE).where({ machine_id: id });
  return { ...machine, operators };
}

export async function createMachine({ code, name, type, location, status, metadata, controller_type, controller_model }, req = null) {
  const existing = await db(TABLE).where({ code }).first();
  if (existing) {
    const err = new Error(`Exista deja un utilaj cu codul "${code}".`);
    err.statusCode = 409;
    err.code = 'COD_DUPLICAT';
    throw err;
  }

  const [machine] = await db(TABLE)
    .insert({
      code, name, type, location: location || null, status: status || 'active',
      metadata: metadata || {},
      controller_type: controller_type || null,
      controller_model: controller_model || null,
      ...extractTenant(req),
    })
    .returning('*');

  return machine;
}

export async function updateMachine(id, { name, type, location, status, metadata, controller_type, controller_model }) {
  const machine = await db(TABLE).where({ id }).first();
  if (!machine) {
    const err = new Error('Utilajul nu a fost gasit.');
    err.statusCode = 404;
    err.code = 'UTILAJ_NEGASIT';
    throw err;
  }

  const updates = { updated_at: new Date() };
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (location !== undefined) updates.location = location;
  if (status !== undefined) updates.status = status;
  if (metadata !== undefined) updates.metadata = metadata;
  if (controller_type !== undefined) updates.controller_type = controller_type;
  if (controller_model !== undefined) updates.controller_model = controller_model;

  const [updated] = await db(TABLE).where({ id }).update(updates).returning('*');
  return updated;
}

export async function deleteMachine(id) {
  const machine = await db(TABLE).where({ id }).first();
  if (!machine) {
    const err = new Error('Utilajul nu a fost gasit.');
    err.statusCode = 404;
    err.code = 'UTILAJ_NEGASIT';
    throw err;
  }

  await db(TABLE).where({ id }).del();
}

export async function assignOperator(machineId, userId) {
  await getMachine(machineId);

  const existing = await db(OPERATORS_TABLE).where({ machine_id: machineId, user_id: userId }).first();
  if (existing) {
    const err = new Error('Operatorul este deja asignat acestui utilaj.');
    err.statusCode = 409;
    err.code = 'OPERATOR_DEJA_ASIGNAT';
    throw err;
  }

  await db(OPERATORS_TABLE).insert({ machine_id: machineId, user_id: userId });
}

export async function removeOperator(machineId, userId) {
  await getMachine(machineId);
  await db(OPERATORS_TABLE).where({ machine_id: machineId, user_id: userId }).del();
}

// ─── Machine Groups ───────────────────────────────────────────────────────────

export async function listGroups(req = null) {
  let q = db('machines.machine_groups').orderBy('name');
  applyScopeFilter(q, req);
  const groups = await q;
  return Promise.all(groups.map(async (g) => {
    const [{ count }] = await db('machines.group_machines').where({ group_id: g.id }).count('* as count');
    return { ...g, machine_count: Number(count) };
  }));
}

export async function getGroup(id) {
  const group = await db('machines.machine_groups').where({ id }).first();
  if (!group) return null;
  const machines = await db('machines.machines as m')
    .join('machines.group_machines as gm', 'm.id', 'gm.machine_id')
    .where('gm.group_id', id).select('m.*');
  return { ...group, machines };
}

export async function createGroup(data, req = null) {
  const [group] = await db('machines.machine_groups').insert({
    name: data.name, description: data.description, is_active: data.isActive !== false, ...extractTenant(req),
  }).returning('*');
  return group;
}

export async function updateGroup(id, data) {
  const row = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.description !== undefined) row.description = data.description;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  const [group] = await db('machines.machine_groups').where({ id }).update(row).returning('*');
  return group;
}

export async function addMachineToGroup(groupId, machineId) {
  await db('machines.group_machines')
    .insert({ group_id: groupId, machine_id: machineId })
    .onConflict(['group_id', 'machine_id']).ignore();
  return getGroup(groupId);
}

export async function removeMachineFromGroup(groupId, machineId) {
  await db('machines.group_machines').where({ group_id: groupId, machine_id: machineId }).delete();
}

// ─── Machine Capabilities ─────────────────────────────────────────────────────

export async function listCapabilities(machineId) {
  return db('machines.machine_capabilities').where({ machine_id: machineId }).orderBy('operation_type');
}

export async function addCapability(machineId, data) {
  const [cap] = await db('machines.machine_capabilities').insert({
    machine_id: machineId,
    operation_type: data.operationType,
    operation_name: data.operationName,
    cycle_time_seconds: data.cycleTimeSeconds,
    hourly_rate_eur: data.hourlyRateEur,
    setup_time_minutes: data.setupTimeMinutes || 0,
    nr_cavities: data.nrCavities || 1,
    is_preferred: data.isPreferred || false,
    notes: data.notes,
  }).returning('*');
  return cap;
}

export async function updateCapability(id, data) {
  const row = {};
  const map = {
    operationType: 'operation_type', operationName: 'operation_name',
    cycleTimeSeconds: 'cycle_time_seconds', hourlyRateEur: 'hourly_rate_eur',
    setupTimeMinutes: 'setup_time_minutes', nrCavities: 'nr_cavities',
    isPreferred: 'is_preferred', notes: 'notes',
  };
  for (const [k, v] of Object.entries(map)) {
    if (data[k] !== undefined) row[v] = data[k];
  }
  const [cap] = await db('machines.machine_capabilities').where({ id }).update(row).returning('*');
  return cap;
}

export async function deleteCapability(id) {
  return db('machines.machine_capabilities').where({ id }).delete();
}

// ─── Machine Planning View ────────────────────────────────────────────────────

export async function getMachinePlanning(machineId, dateFrom, dateTo) {
  const from = dateFrom || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const to = dateTo || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const [machine, allocations, workOps] = await Promise.all([
    db('machines.machines').where({ id: machineId }).first(),
    db('planning.daily_allocations')
      .where({ machine_id: machineId })
      .where('plan_date', '>=', from)
      .where('plan_date', '<=', to)
      .orderBy(['plan_date', 'shift']),
    db('production.work_order_operations as woo')
      .join('production.work_orders as wo', 'woo.work_order_id', 'wo.id')
      .where('woo.machine_id', machineId)
      .whereIn('woo.status', ['planned', 'in_progress'])
      .select('woo.*', 'wo.work_order_number', 'wo.product_name', 'wo.quantity',
        'wo.scheduled_start', 'wo.scheduled_end')
      .orderBy('wo.scheduled_start')
      .catch(() => []),
  ]);
  return { machine, allocations, workOrderOperations: workOps };
}
