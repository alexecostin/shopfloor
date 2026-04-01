import db from '../../config/db.js';
import { generateSchedule as runScheduler } from '../../services/scheduler.service.js';

// Cache shift definitions to avoid repeated queries
let _shiftDefCache = null;
let _shiftDefCacheTime = 0;
async function getShiftDef(shiftName) {
  const now = Date.now();
  if (!_shiftDefCache || (now - _shiftDefCacheTime) > 5 * 60 * 1000) {
    _shiftDefCache = await db('shifts.shift_definitions').select('*').catch(() => []);
    _shiftDefCacheTime = now;
  }
  return _shiftDefCache.find(s => s.shift_name === shiftName) || null;
}

// ─── CONFIGS ─────────────────────────────────────────────────────────────────

export const listConfigs = () => db('planning.scheduling_configs').orderBy('is_default', 'desc').orderBy('created_at', 'desc');

export const getConfig = id => db('planning.scheduling_configs').where('id', id).first();

export const createConfig = async (data, userId) => {
  if (data.priorities) {
    const weights = data.priorities.reduce((s, p) => s + (p.weight || 0), 0);
    if (Math.abs(weights - 100) > 0.01) throw Object.assign(new Error('Suma ponderilor trebuie sa fie 100.'), { statusCode: 400 });
  }
  const row = { ...data, created_by: userId };
  if (row.priorities && typeof row.priorities !== 'string') row.priorities = JSON.stringify(row.priorities);
  if (row.constraints && typeof row.constraints !== 'string') row.constraints = JSON.stringify(row.constraints);
  const [r] = await db('planning.scheduling_configs').insert(row).returning('*');
  return r;
};

export const updateConfig = async (id, data) => {
  if (data.priorities) {
    const weights = data.priorities.reduce((s, p) => s + (p.weight || 0), 0);
    if (Math.abs(weights - 100) > 0.01) throw Object.assign(new Error('Suma ponderilor trebuie sa fie 100.'), { statusCode: 400 });
  }
  const [r] = await db('planning.scheduling_configs').where('id', id).update({ ...data, updated_at: new Date() }).returning('*');
  return r;
};

export const deleteConfig = id => db('planning.scheduling_configs').where('id', id).delete();

export const setDefaultConfig = async id => {
  await db('planning.scheduling_configs').update({ is_default: false });
  const [r] = await db('planning.scheduling_configs').where('id', id).update({ is_default: true, updated_at: new Date() }).returning('*');
  return r;
};

// ─── RUNS ─────────────────────────────────────────────────────────────────────

export const listRuns = ({ type, status } = {}) => {
  let q = db('planning.scheduling_runs').orderBy('created_at', 'desc');
  if (type) q = q.where('run_type', type);
  if (status) q = q.where('status', status);
  return q;
};

export const getRun = async id => {
  const run = await db('planning.scheduling_runs').where('id', id).first();
  if (!run) return null;
  const ops = await db('planning.scheduled_operations').where('run_id', id).orderBy(['planned_date', 'sequence']);
  return { ...run, scheduled_operations: ops };
};

export const deleteRun = async id => {
  await db('planning.scheduled_operations').where('run_id', id).delete();
  return db('planning.scheduling_runs').where('id', id).delete();
};

// ─── OPERATIONS ───────────────────────────────────────────────────────────────

export const getRunOperations = ({ runId, machineId, date }) => {
  let q = db('planning.scheduled_operations as so')
    .join('machines.machines as m', 'so.machine_id', 'm.id')
    .leftJoin('auth.users as u', 'so.operator_id', 'u.id')
    .select('so.*', 'm.code as machine_code', 'm.name as machine_name', 'u.full_name as operator_name')
    .where('so.run_id', runId)
    .orderBy(['so.planned_date', 'so.sequence']);
  if (machineId) q = q.where('so.machine_id', machineId);
  if (date) q = q.where('so.planned_date', date);
  return q;
};

export const getGanttData = async ({ runId, dateFrom, dateTo }) => {
  let q = db('planning.scheduled_operations as so')
    .join('machines.machines as m', 'so.machine_id', 'm.id')
    .leftJoin('auth.users as u', 'so.operator_id', 'u.id')
    .select('so.*', 'm.id as mid', 'm.code as machine_code', 'm.name as machine_name', 'u.full_name as operator_name')
    .where('so.run_id', runId)
    .orderBy(['m.code', 'so.planned_date', 'so.sequence']);
  if (dateFrom) q = q.where('so.planned_date', '>=', dateFrom);
  if (dateTo) q = q.where('so.planned_date', '<=', dateTo);
  const rows = await q;

  const machineMap = {};
  for (const row of rows) {
    if (!machineMap[row.mid]) {
      machineMap[row.mid] = { machineId: row.mid, machineCode: row.machine_code, machineName: row.machine_name, days: {} };
    }
    const dateKey = row.planned_date instanceof Date ? row.planned_date.toISOString().split('T')[0] : row.planned_date;
    if (!machineMap[row.mid].days[dateKey]) machineMap[row.mid].days[dateKey] = [];
    const color = row.status === 'conflict' ? '#ef4444' : row.status === 'applied' ? '#22c55e' : '#3b82f6';
    // Read shift start/end times from shift_definitions, fall back to defaults
    const shiftDef = await getShiftDef(row.planned_shift);
    machineMap[row.mid].days[dateKey].push({
      id: row.id,
      startTime: shiftDef?.start_time || '06:00',
      endTime: shiftDef?.end_time || '14:00',
      productName: row.product_name,
      productCode: row.product_code,
      qty: row.quantity,
      setupMin: row.setup_minutes,
      operatorName: row.operator_name,
      status: row.status,
      color,
      planned_hours: row.planned_hours,
    });
  }

  return Object.values(machineMap).map(m => ({
    ...m,
    days: Object.entries(m.days).map(([date, operations]) => ({ date, operations })).sort((a, b) => a.date.localeCompare(b.date)),
  }));
};

export const updateOperation = async (id, data) => {
  const [op] = await db('planning.scheduled_operations').where('id', id).update(data).returning('*');
  if (!op) return null;

  // Check for conflicts on same machine+date+shift
  const conflicts = await db('planning.scheduled_operations')
    .where({ machine_id: op.machine_id, planned_date: op.planned_date, planned_shift: op.planned_shift, run_id: op.run_id })
    .whereNot('id', op.id);

  if (conflicts.length > 0) {
    await db('planning.scheduled_operations').where('id', op.id).update({ status: 'conflict', conflict_reason: `Conflict cu ${conflicts.length} alte operatii pe aceeasi masina/tura.` });
    return { ...op, status: 'conflict' };
  }

  return op;
};

export const applyRun = async (runId) => {
  const run = await db('planning.scheduling_runs').where('id', runId).first();
  if (!run) return null;

  const ops = await db('planning.scheduled_operations').where({ run_id: runId, status: 'planned' });

  // Create a master plan to hold these allocations
  const [plan] = await db('planning.master_plans').insert({
    name: `Plan automat — ${run.name || 'Scheduling run'}`,
    plan_type: 'auto',
    start_date: run.period_start,
    end_date: run.period_end,
    status: 'active',
    notes: `Generat automat din scheduling run ${runId}.\nOperatii: ${ops.length}`,
    created_by: run.created_by,
  }).returning('*');

  // Copy to planning.daily_allocations linked to the new master plan
  for (const op of ops) {
    await db('planning.daily_allocations').insert({
      master_plan_id: plan.id,
      machine_id: op.machine_id,
      product_id: null,
      product_reference: op.product_code,
      product_name: op.product_name,
      plan_date: op.planned_date,
      shift: op.planned_shift,
      planned_qty: op.quantity || 0,
      planned_hours: op.planned_hours || null,
      notes: `Auto-scheduling: ${op.product_name || op.product_code}`,
    }).catch(() => {}); // ignore conflicts

    await db('planning.scheduled_operations').where('id', op.id).update({ status: 'applied' });
  }

  const [updated] = await db('planning.scheduling_runs').where('id', runId)
    .update({ status: 'applied', master_plan_id: plan.id }).returning('*').catch(() =>
      db('planning.scheduling_runs').where('id', runId).update({ status: 'applied' }).returning('*')
    );
  return { ...updated, masterPlanId: plan.id, allocationsCreated: ops.length };
};

// ─── SIMULATIONS ──────────────────────────────────────────────────────────────

export const listSimulations = () => db('planning.simulations').orderBy('created_at', 'desc');

export const getSimulation = async id => {
  const sim = await db('planning.simulations').where('id', id).first();
  if (!sim) return null;

  let baseOps = [], simOps = [];
  if (sim.base_run_id) {
    baseOps = await db('planning.scheduled_operations').where('run_id', sim.base_run_id).orderBy(['planned_date', 'sequence']);
  }
  if (sim.simulation_run_id) {
    simOps = await db('planning.scheduled_operations').where('run_id', sim.simulation_run_id).orderBy(['planned_date', 'sequence']);
  }

  return { ...sim, base_operations: baseOps, simulation_operations: simOps };
};

export const compareSimulation = async id => {
  const sim = await db('planning.simulations').where('id', id).first();
  if (!sim) return null;

  const baseRun = sim.base_run_id ? await db('planning.scheduling_runs').where('id', sim.base_run_id).first() : null;
  const simRun = sim.simulation_run_id ? await db('planning.scheduling_runs').where('id', sim.simulation_run_id).first() : null;

  const baseOps = baseRun ? await db('planning.scheduled_operations').where('run_id', sim.base_run_id) : [];
  const simOps = simRun ? await db('planning.scheduled_operations').where('run_id', sim.simulation_run_id) : [];

  // Identify delayed orders (in sim vs base)
  const baseOrderDates = {};
  for (const op of baseOps) {
    if (!baseOrderDates[op.order_id] || op.planned_date > baseOrderDates[op.order_id]) {
      baseOrderDates[op.order_id] = op.planned_date;
    }
  }
  const simOrderDates = {};
  for (const op of simOps) {
    if (!simOrderDates[op.order_id] || op.planned_date > simOrderDates[op.order_id]) {
      simOrderDates[op.order_id] = op.planned_date;
    }
  }

  const orders_delayed = [];
  for (const [orderId, baseDate] of Object.entries(baseOrderDates)) {
    const simDate = simOrderDates[orderId];
    if (simDate && simDate > baseDate) {
      orders_delayed.push({ order_id: orderId, base_end: baseDate, sim_end: simDate });
    }
  }

  const diff = {
    orders_delayed,
    base_scheduled: baseOps.length,
    sim_scheduled: simOps.length,
    base_summary: baseRun?.result_summary || {},
    sim_summary: simRun?.result_summary || {},
  };

  return {
    base: { operations: baseOps, summary: baseRun?.result_summary || {} },
    simulation: { operations: simOps, summary: simRun?.result_summary || {} },
    diff,
  };
};

export const createSimulation = async (data, userId) => {
  const { name, description, baseRunId, constraintsModified, periodStart, periodEnd, configId } = data;

  // Get period from base run if not provided
  let pStart = periodStart, pEnd = periodEnd, cfgId = configId;
  if (baseRunId) {
    const baseRun = await db('planning.scheduling_runs').where('id', baseRunId).first();
    if (baseRun) {
      pStart = pStart || baseRun.period_start;
      pEnd = pEnd || baseRun.period_end;
      cfgId = cfgId || baseRun.config_id;
    }
  }

  if (!pStart || !pEnd) throw Object.assign(new Error('periodStart si periodEnd sunt obligatorii.'), { statusCode: 400 });

  // Create simulation record
  const [sim] = await db('planning.simulations').insert({
    name,
    description,
    base_run_id: baseRunId || null,
    constraints_modified: JSON.stringify(constraintsModified || {}),
    status: 'running',
    created_by: userId,
  }).returning('*');

  try {
    const simName = `[SIM] ${name}`;
    const result = await runSchedulerWithConstraints(cfgId, pStart, pEnd, simName, userId, constraintsModified || {});

    await db('planning.simulations').where('id', sim.id).update({
      simulation_run_id: result.runId,
      status: 'completed',
      impact_summary: JSON.stringify(result.summary),
      completed_at: new Date(),
    });

    // Update the sim run to be type 'simulation'
    await db('planning.scheduling_runs').where('id', result.runId).update({ run_type: 'simulation' });

    const [updated] = await db('planning.simulations').where('id', sim.id).returning('*');
    return { simulation: updated, summary: result.summary, warnings: result.warnings };
  } catch (err) {
    await db('planning.simulations').where('id', sim.id).update({ status: 'failed', completed_at: new Date() });
    throw err;
  }
};

async function runSchedulerWithConstraints(configId, periodStart, periodEnd, name, userId, constraints) {
  const disabledMachines = constraints.machines_disabled || [];
  const tempMaintenanceIds = [];

  for (const machineId of disabledMachines) {
    try {
      const [req] = await db('maintenance.requests').insert({
        machine_id: machineId,
        requested_by: userId,
        description: '[SIM] Masina dezactivata pentru simulare',
        priority: 'critical',
        status: 'in_progress',
      }).returning('id');
      tempMaintenanceIds.push(req.id);
    } catch (e) { /* ignore */ }
  }

  try {
    const result = await runScheduler(configId, periodStart, periodEnd, name, userId);
    return result;
  } finally {
    if (tempMaintenanceIds.length > 0) {
      await db('maintenance.requests').whereIn('id', tempMaintenanceIds).delete();
    }
  }
}

export const applySimulation = async id => {
  const sim = await db('planning.simulations').where('id', id).first();
  if (!sim || !sim.simulation_run_id) return null;

  const applied = await applyRun(sim.simulation_run_id);
  await db('planning.simulations').where('id', id).update({ status: 'applied' });
  return applied;
};

export const deleteSimulation = async id => {
  const sim = await db('planning.simulations').where('id', id).first();
  if (sim?.simulation_run_id) {
    await db('planning.scheduled_operations').where('run_id', sim.simulation_run_id).delete();
    await db('planning.scheduling_runs').where('id', sim.simulation_run_id).delete();
  }
  return db('planning.simulations').where('id', id).delete();
};
