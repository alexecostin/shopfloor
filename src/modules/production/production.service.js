import db from '../../config/db.js';
import { applyScopeFilter } from '../../middleware/scopeFilter.js';
import * as shiftService from '../../services/shift.service.js';
import { getTenantConfig } from '../../services/app-config.service.js';

function extractTenant(req) {
  return {
    tenant_id: req?.tenantFilter?.tenantId || null,
    org_unit_id: req?.user?.scopes?.[0]?.orgUnitId || null,
  };
}

// ── ORDERS ───────────────────────────────────────────────────────────────────

export async function listOrders({ status, machineId, page = 1, limit = 50 } = {}, req = null) {
  const offset = (page - 1) * limit;
  let query = db('production.orders');
  applyScopeFilter(query, req);
  if (status) query = query.where({ status });
  if (machineId) query = query.where({ machine_id: machineId });

  const [{ count }] = await query.clone().count('id as count');
  const orders = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);
  return { data: orders, pagination: { page, limit, total: Number(count), pages: Math.ceil(count / limit) } };
}

export async function getOrder(id) {
  const order = await db('production.orders').where({ id }).first();
  if (!order) throw notFound('Comanda nu a fost gasita.', 'COMANDA_NEGASITA');
  return order;
}

export async function createOrder({ orderNumber, productName, productCode, machineId, targetQuantity, status }, req = null) {
  const existing = await db('production.orders').where({ order_number: orderNumber }).first();
  if (existing) throw conflict(`Exista deja o comanda cu numarul "${orderNumber}".`, 'NUMAR_DUPLICAT');

  const [order] = await db('production.orders').insert({
    order_number: orderNumber,
    product_name: productName,
    product_code: productCode || null,
    machine_id: machineId,
    target_quantity: targetQuantity,
    status: status || 'active',
    ...extractTenant(req),
  }).returning('*');
  return order;
}

export async function updateOrder(id, fields) {
  await getOrder(id);
  const updates = { updated_at: new Date() };
  if (fields.productName !== undefined) updates.product_name = fields.productName;
  if (fields.productCode !== undefined) updates.product_code = fields.productCode;
  if (fields.machineId !== undefined) updates.machine_id = fields.machineId;
  if (fields.targetQuantity !== undefined) updates.target_quantity = fields.targetQuantity;
  if (fields.status !== undefined) updates.status = fields.status;
  const [updated] = await db('production.orders').where({ id }).update(updates).returning('*');
  return updated;
}

// ── REPORTS ──────────────────────────────────────────────────────────────────

export async function listReports({ machineId, operatorId, shift, dateFrom, dateTo, page = 1, limit = 50 } = {}, req = null) {
  const offset = (page - 1) * limit;
  let query = db('production.reports');
  applyScopeFilter(query, req);
  if (machineId) query = query.where({ machine_id: machineId });
  if (operatorId) query = query.where({ operator_id: operatorId });
  if (shift) query = query.where({ shift });
  if (dateFrom) query = query.where('reported_at', '>=', dateFrom);
  if (dateTo) query = query.where('reported_at', '<=', dateTo);

  const [{ count }] = await query.clone().count('id as count');
  const reports = await query.orderBy('reported_at', 'desc').limit(limit).offset(offset);
  return { data: reports, pagination: { page, limit, total: Number(count), pages: Math.ceil(count / limit) } };
}

export async function createReport({ orderId, machineId, shift, goodPieces, scrapPieces, scrapReason, scrapReasonCode, reworkPieces, reworkReasonCode, notes }, operatorId, req = null) {
  const tenant = extractTenant(req);
  const [report] = await db('production.reports').insert({
    order_id: orderId || null,
    machine_id: machineId,
    operator_id: operatorId,
    shift,
    good_pieces: goodPieces,
    scrap_pieces: scrapPieces || 0,
    scrap_reason: scrapReason || null,
    scrap_reason_code: scrapReasonCode || null,
    rework_pieces: reworkPieces || 0,
    rework_reason_code: reworkReasonCode || null,
    notes: notes || null,
    ...tenant,
  }).returning('*');

  // Auto-create rework_queue entry when reworkPieces > 0
  if (reworkPieces && reworkPieces > 0) {
    const { createFromReport } = await import('../../services/rework.service.js');
    await createFromReport(report.id, reworkPieces, reworkReasonCode || null, tenant.tenant_id, tenant.org_unit_id).catch(() => {});
  }

  return report;
}

// ── STOPS ────────────────────────────────────────────────────────────────────

export async function listStops({ machineId, shift, open, page = 1, limit = 50 } = {}, req = null) {
  const offset = (page - 1) * limit;
  let query = db('production.stops');
  applyScopeFilter(query, req);
  if (machineId) query = query.where({ machine_id: machineId });
  if (shift) query = query.where({ shift });
  if (open === true) query = query.whereNull('ended_at');
  if (open === false) query = query.whereNotNull('ended_at');

  const [{ count }] = await query.clone().count('id as count');
  const stops = await query.orderBy('started_at', 'desc').limit(limit).offset(offset);
  return { data: stops, pagination: { page, limit, total: Number(count), pages: Math.ceil(count / limit) } };
}

export async function createStop({ machineId, reason, category, shift, notes }, operatorId, req = null) {
  const [stop] = await db('production.stops').insert({
    machine_id: machineId,
    operator_id: operatorId,
    reason,
    category: category || null,
    shift: shift || null,
    notes: notes || null,
    ...extractTenant(req),
  }).returning('*');
  return stop;
}

export async function closeStop(id, { notes } = {}) {
  const stop = await db('production.stops').where({ id }).first();
  if (!stop) throw notFound('Oprirea nu a fost gasita.', 'OPRIRE_NEGASITA');
  if (stop.ended_at) throw conflict('Aceasta oprire este deja inchisa.', 'OPRIRE_DEJA_INCHISA');

  const endedAt = new Date();
  const durationMinutes = Math.round((endedAt - new Date(stop.started_at)) / 60000);

  const [updated] = await db('production.stops').where({ id }).update({
    ended_at: endedAt,
    duration_minutes: durationMinutes,
    notes: notes || stop.notes,
  }).returning('*');
  return updated;
}

// ── SHIFTS ───────────────────────────────────────────────────────────────────

export async function listShifts({ date, status, page = 1, limit = 20 } = {}, req = null) {
  const offset = (page - 1) * limit;
  let query = db('production.shifts');
  applyScopeFilter(query, req);
  if (date) query = query.where({ date });
  if (status) query = query.where({ status });

  const [{ count }] = await query.clone().count('id as count');
  const shifts = await query.orderBy('started_at', 'desc').limit(limit).offset(offset);
  return { data: shifts, pagination: { page, limit, total: Number(count), pages: Math.ceil(count / limit) } };
}

export async function createShift({ shiftName, date, notesIncoming }, shiftLeaderId, req = null) {
  const [shift] = await db('production.shifts').insert({
    shift_name: shiftName,
    shift_leader_id: shiftLeaderId,
    date: date || new Date().toISOString().slice(0, 10),
    notes_incoming: notesIncoming || null,
    status: 'active',
    ...extractTenant(req),
  }).returning('*');
  return shift;
}

export async function closeShift(id, { notesOutgoing } = {}) {
  const shift = await db('production.shifts').where({ id }).first();
  if (!shift) throw notFound('Tura nu a fost gasita.', 'TURA_NEGASITA');
  if (shift.status === 'closed') throw conflict('Aceasta tura este deja inchisa.', 'TURA_DEJA_INCHISA');

  const [updated] = await db('production.shifts').where({ id }).update({
    status: 'closed',
    ended_at: new Date(),
    notes_outgoing: notesOutgoing || null,
  }).returning('*');
  return updated;
}

// ── OEE ──────────────────────────────────────────────────────────────────────

export async function getOEE({ machineId, date, shift } = {}) {
  // Get planned production time from shift config, fall back to tenant config
  const oeeCfg = await getTenantConfig(null).catch(() => ({}));
  let shiftDuration = oeeCfg.defaultShiftDurationMinutes || 450; // fallback from config
  if (machineId && date) {
    try {
      const { totalHours } = await shiftService.getAvailableHours(machineId, date);
      if (totalHours > 0) shiftDuration = totalHours * 60;
    } catch (_) { /* keep fallback */ }
  }

  let reportsQuery = db('production.reports').where({ machine_id: machineId });
  let stopsQuery = db('production.stops').where({ machine_id: machineId }).whereNotNull('ended_at');

  if (date) {
    reportsQuery = reportsQuery.whereRaw('DATE(reported_at) = ?', [date]);
    stopsQuery = stopsQuery.whereRaw('DATE(started_at) = ?', [date]);
  }
  if (shift) {
    reportsQuery = reportsQuery.where({ shift });
    stopsQuery = stopsQuery.where({ shift });
  }

  const reports = await reportsQuery;
  const stops = await stopsQuery;

  const totalGood = reports.reduce((s, r) => s + r.good_pieces, 0);
  const totalScrap = reports.reduce((s, r) => s + r.scrap_pieces, 0);
  const totalPieces = totalGood + totalScrap;
  const totalDowntime = stops.reduce((s, st) => s + (st.duration_minutes || 0), 0);

  const availability = shiftDuration > 0 ? (shiftDuration - totalDowntime) / shiftDuration : 0;
  const quality = totalPieces > 0 ? totalGood / totalPieces : 0;
  // Performance requires ideal cycle time — default to 1 if not configured
  const performance = 1;

  const oee = availability * performance * quality;

  return {
    machineId,
    date,
    shift,
    oee: Math.round(oee * 10000) / 100,
    availability: Math.round(availability * 10000) / 100,
    performance: Math.round(performance * 10000) / 100,
    quality: Math.round(quality * 10000) / 100,
    totalGoodPieces: totalGood,
    totalScrapPieces: totalScrap,
    totalDowntimeMinutes: totalDowntime,
    stopsCount: stops.length,
  };
}

export async function getDashboard({ date, shift } = {}) {
  const machines = await db('machines.machines').where({ status: 'active' });

  const oeeList = await Promise.all(
    machines.map((m) => getOEE({ machineId: m.id, date, shift }).then((oee) => ({ ...oee, machineCode: m.code, machineName: m.name })))
  );

  const avgOEE = oeeList.length > 0
    ? Math.round(oeeList.reduce((s, o) => s + o.oee, 0) / oeeList.length * 100) / 100
    : 0;

  return { date, shift, avgOEE, machines: oeeList };
}

// ── helpers ───────────────────────────────────────────────────────────────────
function notFound(message, code) {
  const err = new Error(message);
  err.statusCode = 404;
  err.code = code;
  return err;
}

function conflict(message, code) {
  const err = new Error(message);
  err.statusCode = 409;
  err.code = code;
  return err;
}
