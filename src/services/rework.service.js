import db from '../config/db.js';

const TABLE = 'production.rework_queue';

// ── helpers ─────────────────────────────────────────────────────────────────
function notFound(message, code) {
  const err = new Error(message);
  err.statusCode = 404;
  err.code = code;
  return err;
}

function badRequest(message, code) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

// ── createFromReport ────────────────────────────────────────────────────────
export async function createFromReport(reportId, reworkQty, reworkReason, tenantId = null, orgUnitId = null) {
  // Fetch report to get order / machine info
  const report = await db('production.reports').where({ id: reportId }).first();
  if (!report) throw notFound('Raportul sursa nu a fost gasit.', 'RAPORT_NEGASIT');

  let orderInfo = {};
  if (report.order_id) {
    const order = await db('production.orders').where({ id: report.order_id }).first();
    if (order) {
      orderInfo = {
        product_reference: order.product_code || null,
        product_name: order.product_name || null,
      };
    }
  }

  const [item] = await db(TABLE).insert({
    source_report_id: reportId,
    order_id: report.order_id || null,
    source_machine_id: report.machine_id || null,
    rework_qty: reworkQty,
    rework_reason: reworkReason || null,
    status: 'pending',
    tenant_id: tenantId,
    org_unit_id: orgUnitId,
    ...orderInfo,
  }).returning('*');

  return item;
}

// ── listQueue ───────────────────────────────────────────────────────────────
export async function listQueue({ status, orderId, machineId, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  let query = db(TABLE);

  if (status) query = query.where({ status });
  if (orderId) query = query.where({ order_id: orderId });
  if (machineId) query = query.where(function () {
    this.where({ source_machine_id: machineId }).orWhere({ target_machine_id: machineId });
  });

  const [{ count }] = await query.clone().count('id as count');
  const data = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

  return {
    data,
    pagination: { page, limit, total: Number(count), pages: Math.ceil(count / limit) },
  };
}

// ── getItem ─────────────────────────────────────────────────────────────────
export async function getItem(id) {
  const item = await db(TABLE).where({ id }).first();
  if (!item) throw notFound('Elementul de reprelucrare nu a fost gasit.', 'REWORK_NEGASIT');
  return item;
}

// ── assignMachine ───────────────────────────────────────────────────────────
export async function assignMachine(id, targetMachineId) {
  const item = await getItem(id);
  if (item.status === 'completed' || item.status === 'scrapped') {
    throw badRequest('Nu se poate atribui o masina unui element finalizat.', 'REWORK_FINALIZAT');
  }

  const [updated] = await db(TABLE).where({ id }).update({
    target_machine_id: targetMachineId,
    status: 'planned',
  }).returning('*');
  return updated;
}

// ── startRework ─────────────────────────────────────────────────────────────
export async function startRework(id) {
  const item = await getItem(id);
  if (item.status === 'completed' || item.status === 'scrapped') {
    throw badRequest('Elementul este deja finalizat.', 'REWORK_FINALIZAT');
  }
  if (item.status === 'in_progress') {
    throw badRequest('Reprelucrarea este deja in desfasurare.', 'REWORK_DEJA_INCEPUT');
  }

  const [updated] = await db(TABLE).where({ id }).update({
    status: 'in_progress',
    started_at: new Date(),
  }).returning('*');
  return updated;
}

// ── completeRework ──────────────────────────────────────────────────────────
export async function completeRework(id, { reworkGood = 0, reworkScrapped = 0, notes } = {}) {
  const item = await getItem(id);
  if (item.status === 'completed' || item.status === 'scrapped') {
    throw badRequest('Elementul este deja finalizat.', 'REWORK_FINALIZAT');
  }

  const totalProcessed = reworkGood + reworkScrapped;
  if (totalProcessed > item.rework_qty) {
    throw badRequest('Suma pieselor bune + rebutate depaseste cantitatea de reprelucrare.', 'CANTITATE_DEPASITA');
  }

  const finalStatus = reworkGood > 0 ? 'completed' : 'scrapped';

  const [updated] = await db(TABLE).where({ id }).update({
    rework_good: reworkGood,
    rework_scrapped: reworkScrapped,
    notes: notes || item.notes,
    status: finalStatus,
    completed_at: new Date(),
  }).returning('*');
  return updated;
}

// ── updateItem (generic update for notes, target_machine, assigned_to) ─────
export async function updateItem(id, fields) {
  const item = await getItem(id);
  const updates = {};

  if (fields.targetMachineId !== undefined) updates.target_machine_id = fields.targetMachineId;
  if (fields.assignedTo !== undefined) updates.assigned_to = fields.assignedTo;
  if (fields.notes !== undefined) updates.notes = fields.notes;
  if (fields.status !== undefined) updates.status = fields.status;

  if (fields.targetMachineId && (item.status === 'pending')) {
    updates.status = 'planned';
  }

  if (Object.keys(updates).length === 0) return item;

  const [updated] = await db(TABLE).where({ id }).update(updates).returning('*');
  return updated;
}

// ── getStats ────────────────────────────────────────────────────────────────
export async function getStats(tenantId = null, dateFrom = null, dateTo = null) {
  let reportsQuery = db('production.reports');
  let reworkQuery = db(TABLE);

  if (tenantId) {
    reportsQuery = reportsQuery.where({ tenant_id: tenantId });
    reworkQuery = reworkQuery.where({ tenant_id: tenantId });
  }
  if (dateFrom) {
    reportsQuery = reportsQuery.where('reported_at', '>=', dateFrom);
    reworkQuery = reworkQuery.where('created_at', '>=', dateFrom);
  }
  if (dateTo) {
    reportsQuery = reportsQuery.where('reported_at', '<=', dateTo);
    reworkQuery = reworkQuery.where('created_at', '<=', dateTo);
  }

  const reports = await reportsQuery.select(
    db.raw('COALESCE(SUM(good_pieces), 0) as total_good'),
    db.raw('COALESCE(SUM(scrap_pieces), 0) as total_scrap'),
    db.raw('COALESCE(SUM(rework_pieces), 0) as total_rework_pieces'),
    db.raw('COALESCE(SUM(good_pieces + scrap_pieces), 0) as total_produced'),
  ).first();

  const rework = await reworkQuery.select(
    db.raw('COUNT(*) as total_items'),
    db.raw("COUNT(*) FILTER (WHERE status = 'completed') as completed_items"),
    db.raw("COUNT(*) FILTER (WHERE status = 'scrapped') as scrapped_items"),
    db.raw("COUNT(*) FILTER (WHERE status IN ('pending','planned','in_progress')) as active_items"),
    db.raw('COALESCE(SUM(rework_good), 0) as total_recovered'),
    db.raw('COALESCE(SUM(rework_scrapped), 0) as total_final_scrap'),
    db.raw('COALESCE(SUM(rework_qty), 0) as total_rework_qty'),
  ).first();

  const totalProduced = Number(reports.total_produced) || 0;
  const totalScrap = Number(reports.total_scrap) || 0;
  const totalReworkPieces = Number(reports.total_rework_pieces) || 0;
  const totalRecovered = Number(rework.total_recovered) || 0;
  const totalFinalScrap = Number(rework.total_final_scrap) || 0;

  return {
    scrapRate: totalProduced > 0 ? Math.round((totalScrap / totalProduced) * 10000) / 100 : 0,
    reworkRate: totalProduced > 0 ? Math.round((totalReworkPieces / totalProduced) * 10000) / 100 : 0,
    recoveryRate: totalReworkPieces > 0 ? Math.round((totalRecovered / totalReworkPieces) * 10000) / 100 : 0,
    totalProduced,
    totalScrap,
    totalReworkPieces,
    totalRecovered,
    totalFinalScrap,
    queueItems: Number(rework.total_items),
    activeItems: Number(rework.active_items),
    completedItems: Number(rework.completed_items),
    scrappedItems: Number(rework.scrapped_items),
  };
}
