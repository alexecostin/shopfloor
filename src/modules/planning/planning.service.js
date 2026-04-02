import db from '../../config/db.js';
import * as shiftService from '../../services/shift.service.js';
import { escapeLike } from '../../utils/sanitize.js';
import { getTenantConfig } from '../../services/app-config.service.js';

// ─── Master Plans ─────────────────────────────────────────────────────────────

export async function listMasterPlans({ page = 1, limit = 20, status, year } = {}) {
  const offset = (page - 1) * limit;
  let q = db('planning.master_plans');
  if (status) q = q.where('status', status);
  if (year) q = q.where('year', year);
  const [{ count }] = await q.clone().count('* as count');
  const data = await q.clone().orderBy('start_date', 'desc').limit(limit).offset(offset);
  return { data, total: Number(count), page, limit };
}

export async function getMasterPlan(id) {
  const plan = await db('planning.master_plans').where({ id }).first();
  if (!plan) return null;
  const [allocations, capacity] = await Promise.all([
    db('planning.daily_allocations').where({ master_plan_id: id }).orderBy(['plan_date', 'shift']),
    db('planning.capacity_load').where({ master_plan_id: id }).orderBy(['plan_date', 'machine_id']),
  ]);
  return { ...plan, allocations, capacity };
}

export async function createMasterPlan(data, userId) {
  const [plan] = await db('planning.master_plans').insert({
    name: data.name,
    plan_type: data.planType || 'weekly',
    week_number: data.weekNumber,
    year: data.year,
    start_date: data.startDate,
    end_date: data.endDate,
    notes: data.notes,
    created_by: userId,
  }).returning('*');
  return plan;
}

export async function updateMasterPlan(id, data) {
  const row = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.status !== undefined) row.status = data.status;
  if (data.revision !== undefined) row.revision = data.revision;
  if (data.notes !== undefined) row.notes = data.notes;
  row.updated_at = new Date();
  const [plan] = await db('planning.master_plans').where({ id }).update(row).returning('*');
  return plan;
}

// ─── Capacity Recalculation ───────────────────────────────────────────────────

export async function recalculateCapacity(machineId, planDate, masterPlanId) {
  const [{ total }] = await db('planning.daily_allocations')
    .where({ machine_id: machineId, plan_date: planDate })
    .whereNot('status', 'cancelled')
    .sum('planned_hours as total');

  const plannedHours = Number(total) || 0;

  // Load shift constraints from default scheduling config, fall back to tenant config
  const tenantCfg = await getTenantConfig(null).catch(() => ({}));
  let maxShiftsPerDay = tenantCfg.defaultMaxShiftsPerDay || 2;
  let overtimePercent = tenantCfg.defaultOvertimePercent || 10;
  const hoursPerShift = tenantCfg.defaultHoursPerShift || 7.5;
  try {
    const config = await db('planning.scheduling_configs').where('is_default', true).first();
    if (config?.constraints) {
      const c = typeof config.constraints === 'string' ? JSON.parse(config.constraints) : config.constraints;
      if (c.max_shifts_per_day) maxShiftsPerDay = Number(c.max_shifts_per_day);
      if (c.overtime_percent !== undefined) overtimePercent = Number(c.overtime_percent);
    }
  } catch (_) { /* keep defaults */ }

  const constrainedMax = maxShiftsPerDay * hoursPerShift * (1 + overtimePercent / 100);

  let availableHours = constrainedMax; // default based on shift constraints
  try {
    const { totalHours } = await shiftService.getAvailableHours(machineId, planDate);
    if (totalHours > 0) availableHours = Math.min(totalHours, constrainedMax);
  } catch (_) { /* keep fallback */ }

  const loadPercent = (plannedHours / availableHours) * 100;

  await db('planning.capacity_load')
    .insert({ machine_id: machineId, plan_date: planDate, available_hours: availableHours, planned_hours: plannedHours, load_percent: loadPercent, master_plan_id: masterPlanId, updated_at: new Date() })
    .onConflict(['machine_id', 'plan_date'])
    .merge(['planned_hours', 'load_percent', 'available_hours', 'master_plan_id', 'updated_at']);
}

// ─── Allocations ──────────────────────────────────────────────────────────────

export async function listAllocations({ planId, date, dateFrom, dateTo, machineId, shift } = {}) {
  let q = db('planning.daily_allocations').orderBy(['plan_date', 'shift']);
  if (planId) q = q.where('master_plan_id', planId);
  if (date) q = q.where('plan_date', date);
  if (dateFrom) q = q.where('plan_date', '>=', dateFrom);
  if (dateTo) q = q.where('plan_date', '<=', dateTo);
  if (machineId) q = q.where('machine_id', machineId);
  if (shift) q = q.where('shift', shift);
  return q;
}

export async function createAllocation(data) {
  const [alloc] = await db('planning.daily_allocations').insert({
    master_plan_id: data.masterPlanId,
    plan_date: data.planDate,
    shift: data.shift,
    machine_id: data.machineId,
    product_id: data.productId,
    product_reference: data.productReference,
    product_name: data.productName,
    order_id: data.orderId,
    planned_qty: data.plannedQty || 0,
    planned_hours: data.plannedHours,
    notes: data.notes,
  }).returning('*');
  await recalculateCapacity(data.machineId, data.planDate, data.masterPlanId);
  return alloc;
}

export async function bulkCreateAllocations(masterPlanId, allocations) {
  const rows = allocations.map((a) => ({
    master_plan_id: masterPlanId,
    plan_date: a.planDate,
    shift: a.shift,
    machine_id: a.machineId,
    product_reference: a.productReference,
    product_name: a.productName,
    planned_qty: a.plannedQty || 0,
    planned_hours: a.plannedHours,
  }));
  const inserted = await db('planning.daily_allocations').insert(rows).returning('*');
  // Recalculate capacity for all unique machine+date combos
  const combos = [...new Set(rows.map((r) => `${r.machine_id}|${r.plan_date}`))];
  for (const combo of combos) {
    const [machineId, planDate] = combo.split('|');
    await recalculateCapacity(machineId, planDate, masterPlanId);
  }
  return inserted;
}

export async function updateAllocation(id, data) {
  const row = {};
  if (data.plannedQty !== undefined) row.planned_qty = data.plannedQty;
  if (data.realizedQty !== undefined) row.realized_qty = data.realizedQty;
  if (data.scrapQty !== undefined) row.scrap_qty = data.scrapQty;
  if (data.status !== undefined) row.status = data.status;
  if (data.notes !== undefined) row.notes = data.notes;
  row.updated_at = new Date();
  const [alloc] = await db('planning.daily_allocations').where({ id }).update(row).returning('*');
  if (alloc) await recalculateCapacity(alloc.machine_id, alloc.plan_date, alloc.master_plan_id);
  return alloc;
}

export async function deleteAllocation(id) {
  const alloc = await db('planning.daily_allocations').where({ id }).first();
  if (!alloc) return;
  await db('planning.daily_allocations').where({ id }).delete();
  await recalculateCapacity(alloc.machine_id, alloc.plan_date, alloc.master_plan_id);
}

// ─── Capacity ─────────────────────────────────────────────────────────────────

export async function listCapacity({ dateFrom, dateTo, machineId } = {}) {
  let q = db('planning.capacity_load as cl')
    .leftJoin('machines.machines as m', 'cl.machine_id', 'm.id')
    .select('cl.*', 'm.code as machine_code', 'm.name as machine_name')
    .orderBy(['cl.plan_date', 'm.code']);
  if (dateFrom) q = q.where('cl.plan_date', '>=', dateFrom);
  if (dateTo) q = q.where('cl.plan_date', '<=', dateTo);
  if (machineId) q = q.where('cl.machine_id', machineId);
  return q;
}

// ─── Customer Demands ─────────────────────────────────────────────────────────

export async function listDemands({ status, dateFrom, dateTo, productReference } = {}) {
  let q = db('planning.customer_demands').orderBy('demand_date');
  if (status) q = q.where('status', status);
  if (dateFrom) q = q.where('demand_date', '>=', dateFrom);
  if (dateTo) q = q.where('demand_date', '<=', dateTo);
  if (productReference) q = q.where('product_reference', 'ilike', `%${escapeLike(productReference)}%`);
  return q;
}

export async function createDemand(data) {
  const [demand] = await db('planning.customer_demands').insert({
    client_name: data.clientName,
    product_id: data.productId,
    product_reference: data.productReference,
    demand_date: data.demandDate,
    required_qty: data.requiredQty,
    delivery_date: data.deliveryDate,
    priority: data.priority || 'normal',
    notes: data.notes,
  }).returning('*');
  return demand;
}

export async function bulkCreateDemands(demands) {
  const rows = demands.map((d) => ({
    client_name: d.clientName,
    product_reference: d.productReference,
    demand_date: d.demandDate,
    required_qty: d.requiredQty,
    delivery_date: d.deliveryDate,
  }));
  return db('planning.customer_demands').insert(rows).returning('*');
}

// ─── Allocation Context (Smart Allocation) ──────────────────────────────────

/**
 * Get allocation context for a machine — what can be allocated.
 * Returns orders with MBOM operations compatible with this machine.
 */
export async function getAllocationContext(machineId) {
  const machine = await db('machines.machines').where('id', machineId).first();
  if (!machine) return { machine: null, availableOperations: [] };

  // Find BOM operations that can run on this machine (primary or alternative)
  const operations = await db('bom.operations as o')
    .join('bom.products as p', 'o.product_id', 'p.id')
    .leftJoin('machines.machines as m', 'o.machine_id', 'm.id')
    .where(q => {
      q.where('o.machine_id', machineId)
       .orWhere('o.machine_type', machine.type);
    })
    .where('p.is_active', true)
    .select('o.*', 'p.reference as product_reference', 'p.name as product_name',
            'p.client_name as bom_client_name',
            'm.code as machine_code', 'm.name as machine_name');

  // Also check alternatives
  const altOps = await db('bom.operation_alternatives as oa')
    .join('bom.operations as o', 'oa.operation_id', 'o.id')
    .join('bom.products as p', 'o.product_id', 'p.id')
    .where('oa.machine_id', machineId)
    .select('o.*', 'p.reference as product_reference', 'p.name as product_name',
            'p.client_name as bom_client_name',
            'oa.cycle_time_seconds_override', 'oa.setup_time_minutes_override');

  // Merge and deduplicate
  const allOps = [...operations];
  for (const alt of altOps) {
    if (!allOps.find(o => o.id === alt.id)) {
      alt.cycle_time_seconds = alt.cycle_time_seconds_override || alt.cycle_time_seconds;
      alt.setup_time_minutes = alt.setup_time_minutes_override || alt.setup_time_minutes;
      allOps.push(alt);
    }
  }

  // Find active work orders that need these products
  const activeOrders = await db('production.work_orders')
    .whereIn('status', ['planned', 'released', 'in_progress'])
    .select('*');

  // Match orders to operations — aggregate by product_reference per operation
  const results = [];
  const aggregatedResults = [];

  for (const op of allOps) {
    const matchingOrders = activeOrders.filter(wo =>
      wo.product_reference === op.product_reference ||
      wo.product_name === op.product_name
    );

    // Calculate already allocated qty for this product_reference
    const [{ allocated }] = await db('planning.daily_allocations')
      .where('product_reference', op.product_reference)
      .whereNot('status', 'cancelled')
      .sum('planned_qty as allocated');
    const alreadyAllocated = Number(allocated) || 0;

    // Aggregated total across ALL orders for this product
    const aggregatedTotalQty = matchingOrders.reduce((sum, wo) => sum + (wo.quantity || 0), 0);
    const aggregatedRemaining = Math.max(0, aggregatedTotalQty - alreadyAllocated);

    // Per-order results (legacy)
    for (const order of matchingOrders) {
      const totalQty = order.quantity || 0;
      const remaining = Math.max(0, totalQty - alreadyAllocated);

      if (remaining > 0) {
        results.push({
          operation: op,
          order: {
            id: order.id,
            orderNumber: order.work_order_number,
            orderRef: order.order_number,
            clientName: op.bom_client_name || null,
            deadline: order.scheduled_end || null,
          },
          productReference: op.product_reference,
          productName: op.product_name,
          operationName: op.operation_name,
          operationType: op.operation_type,
          sequence: op.sequence,
          totalQty,
          alreadyAllocated,
          remaining,
          // Aggregated info
          aggregatedTotalQty,
          aggregatedRemaining,
          orderCount: matchingOrders.length,
          cycleTimeSeconds: Number(op.cycle_time_seconds) || 0,
          setupTimeMinutes: Number(op.setup_time_minutes) || 0,
        });
      }
    }

    // Aggregated result (one row per product+operation)
    if (aggregatedRemaining > 0 && matchingOrders.length > 0) {
      aggregatedResults.push({
        operation: op,
        orders: matchingOrders.map(wo => ({
          id: wo.id,
          orderNumber: wo.work_order_number,
          orderRef: wo.order_number,
          clientName: op.bom_client_name || wo.client_name || null,
          deadline: wo.scheduled_end || null,
          quantity: wo.quantity,
        })),
        productReference: op.product_reference,
        productName: op.product_name,
        operationName: op.operation_name,
        operationType: op.operation_type,
        sequence: op.sequence,
        totalQty: aggregatedTotalQty,
        alreadyAllocated,
        remaining: aggregatedRemaining,
        orderCount: matchingOrders.length,
        cycleTimeSeconds: Number(op.cycle_time_seconds) || 0,
        setupTimeMinutes: Number(op.setup_time_minutes) || 0,
      });
    }
  }

  return { machine, availableOperations: results, aggregatedOperations: aggregatedResults };
}

/**
 * Get machine load for a date range (for visualization).
 */
export async function getMachineLoad(machineId, dateFrom, dateTo) {
  const allocations = await db('planning.daily_allocations')
    .where('machine_id', machineId)
    .where('plan_date', '>=', dateFrom)
    .where('plan_date', '<=', dateTo)
    .whereNot('status', 'cancelled')
    .orderBy('plan_date');

  // Get available hours per day from shift config, fall back to tenant config
  const machineLoadTenantCfg = await getTenantConfig(null).catch(() => ({}));
  const defaultMaxHours = (machineLoadTenantCfg.defaultMaxShiftsPerDay || 2) * (machineLoadTenantCfg.defaultHoursPerShift || 7.5);
  let availableHoursPerDay = defaultMaxHours || 16;
  try {
    const { totalHours } = await shiftService.getAvailableHours(machineId, dateFrom);
    if (totalHours > 0) availableHoursPerDay = totalHours;
  } catch (_) { /* keep fallback */ }

  // Group by date
  const byDate = {};
  for (const a of allocations) {
    const d = (a.plan_date instanceof Date ? a.plan_date.toISOString() : a.plan_date).split('T')[0];
    if (!byDate[d]) byDate[d] = { date: d, allocations: [], totalHours: 0, availableHours: availableHoursPerDay };
    byDate[d].allocations.push(a);
    byDate[d].totalHours += Number(a.planned_hours) || 0;
  }

  // Fill missing dates with empty entries
  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  const cursor = new Date(start);
  while (cursor <= end) {
    const d = cursor.toISOString().split('T')[0];
    if (!byDate[d]) {
      byDate[d] = { date: d, allocations: [], totalHours: 0, availableHours: availableHoursPerDay };
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboard(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const [capacity, allocations, openDemands] = await Promise.all([
    db('planning.capacity_load as cl')
      .leftJoin('machines.machines as m', 'cl.machine_id', 'm.id')
      .select('cl.*', 'm.code as machine_code', 'm.name as machine_name')
      .where('cl.plan_date', '>=', weekStart)
      .where('cl.plan_date', '<=', weekEnd),
    db('planning.daily_allocations')
      .where('plan_date', '>=', weekStart)
      .where('plan_date', '<=', weekEnd),
    db('planning.customer_demands').where('status', 'open').count('* as count').first(),
  ]);

  const avgLoad = capacity.length ? capacity.reduce((s, c) => s + Number(c.load_percent), 0) / capacity.length : 0;
  const overloadedSlots = capacity.filter((c) => Number(c.load_percent) > 100).length;
  const totalPlanned = allocations.reduce((s, a) => s + (a.planned_qty || 0), 0);
  const totalDemand = await db('planning.customer_demands')
    .where('demand_date', '>=', weekStart).where('demand_date', '<=', weekEnd).sum('required_qty as total').first();

  const productMap = {};
  for (const a of allocations) {
    const k = a.product_reference || 'unknown';
    if (!productMap[k]) productMap[k] = { product: k, planned: 0, realized: 0, scrap: 0 };
    productMap[k].planned += a.planned_qty || 0;
    productMap[k].realized += a.realized_qty || 0;
    productMap[k].scrap += a.scrap_qty || 0;
  }

  return {
    kpis: {
      avgLoad: Math.round(avgLoad * 10) / 10,
      overloadedSlots,
      totalPlanned,
      totalDemand: Number(totalDemand?.total) || 0,
      coveragePercent: totalDemand?.total ? Math.round((totalPlanned / Number(totalDemand.total)) * 100) : 0,
      openDemands: Number(openDemands?.count) || 0,
    },
    capacity,
    productSummary: Object.values(productMap),
  };
}
