import db from '../../config/db.js';
import * as shiftService from '../../services/shift.service.js';
import { escapeLike } from '../../utils/sanitize.js';

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

async function recalculateCapacity(machineId, planDate, masterPlanId) {
  const [{ total }] = await db('planning.daily_allocations')
    .where({ machine_id: machineId, plan_date: planDate })
    .whereNot('status', 'cancelled')
    .sum('planned_hours as total');

  const plannedHours = Number(total) || 0;
  let availableHours = 16; // fallback
  try {
    const { totalHours } = await shiftService.getAvailableHours(machineId, planDate);
    if (totalHours > 0) availableHours = totalHours;
  } catch (_) { /* keep fallback */ }
  const loadPercent = (plannedHours / availableHours) * 100;

  await db('planning.capacity_load')
    .insert({ machine_id: machineId, plan_date: planDate, available_hours: availableHours, planned_hours: plannedHours, load_percent: loadPercent, master_plan_id: masterPlanId, updated_at: new Date() })
    .onConflict(['machine_id', 'plan_date'])
    .merge(['planned_hours', 'load_percent', 'master_plan_id', 'updated_at']);
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
