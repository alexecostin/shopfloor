import db from '../config/db.js';

// ─── Lot Tracking ───────────────────────────────────────────────────────

export async function createLot(data) {
  const [lot] = await db('traceability.lot_tracking').insert({
    lot_number: data.lot_number,
    item_id: data.item_id || null,
    supplier_id: data.supplier_id || null,
    received_date: data.received_date || null,
    expiry_date: data.expiry_date || null,
    quantity: data.quantity || 0,
    remaining_quantity: data.remaining_quantity ?? data.quantity ?? 0,
    unit: data.unit || 'buc',
    status: data.status || 'active',
    tenant_id: data.tenant_id || null,
  }).returning('*');
  return lot;
}

export async function listLots({ itemId, status, page = 1, limit = 50 } = {}) {
  let q = db('traceability.lot_tracking');
  if (itemId) q = q.where('item_id', itemId);
  if (status) q = q.where('status', status);
  const [{ count }] = await q.clone().count('* as count');
  const data = await q.clone().orderBy('created_at', 'desc').limit(limit).offset((page - 1) * limit);
  return { data, total: Number(count), page: Number(page), limit: Number(limit) };
}

export async function getLot(id) {
  const lot = await db('traceability.lot_tracking').where('id', id).first();
  if (!lot) return null;
  const usage = await db('traceability.production_lot_usage')
    .where('lot_tracking_id', id)
    .orderBy('created_at', 'desc');
  return { ...lot, usage };
}

// ─── Lot Usage ──────────────────────────────────────────────────────────

export async function recordLotUsage(reportId, lotId, qtyUsed) {
  const lot = await db('traceability.lot_tracking').where('id', lotId).first();
  if (!lot) throw new Error('Lot negasit');
  if (lot.remaining_quantity < qtyUsed) throw new Error('Cantitate insuficienta in lot');

  const [usage] = await db('traceability.production_lot_usage').insert({
    production_report_id: reportId,
    lot_tracking_id: lotId,
    quantity_used: qtyUsed,
  }).returning('*');

  const newRemaining = Number(lot.remaining_quantity) - Number(qtyUsed);
  const newStatus = newRemaining <= 0 ? 'consumed' : lot.status;
  await db('traceability.lot_tracking').where('id', lotId).update({
    remaining_quantity: newRemaining,
    status: newStatus,
  });

  return usage;
}

// ─── Serial Numbers ─────────────────────────────────────────────────────

export async function generateSerialNumbers(productId, reportId, orderId, count, format = 'SN') {
  // Get the max existing serial for this format prefix
  const prefix = format || 'SN';
  const existing = await db('traceability.serial_numbers')
    .where('serial_number', 'like', `${prefix}-%`)
    .orderBy('serial_number', 'desc')
    .first();

  let startNum = 1;
  if (existing) {
    const parts = existing.serial_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) startNum = lastNum + 1;
  }

  // Get lot_tracking_ids from report usage if available
  let lotTrackingIds = [];
  if (reportId) {
    const usages = await db('traceability.production_lot_usage')
      .where('production_report_id', reportId)
      .select('lot_tracking_id');
    lotTrackingIds = usages.map(u => u.lot_tracking_id);
  }

  const serials = [];
  for (let i = 0; i < count; i++) {
    const num = String(startNum + i).padStart(7, '0');
    serials.push({
      serial_number: `${prefix}-${num}`,
      product_id: productId || null,
      production_report_id: reportId || null,
      order_id: orderId || null,
      lot_tracking_ids: JSON.stringify(lotTrackingIds),
      tenant_id: null,
    });
  }

  const inserted = await db('traceability.serial_numbers').insert(serials).returning('*');
  return inserted;
}

export async function listSerials({ productId, orderId, page = 1, limit = 50 } = {}) {
  let q = db('traceability.serial_numbers');
  if (productId) q = q.where('product_id', productId);
  if (orderId) q = q.where('order_id', orderId);
  const [{ count }] = await q.clone().count('* as count');
  const data = await q.clone().orderBy('created_at', 'desc').limit(limit).offset((page - 1) * limit);
  return { data, total: Number(count), page: Number(page), limit: Number(limit) };
}

// ─── Forward Trace: Lot → Reports → Orders ──────────────────────────────

export async function forwardTrace(lotId) {
  const lot = await db('traceability.lot_tracking').where('id', lotId).first();
  if (!lot) return null;

  // Lot → production_lot_usage → reports
  const usages = await db('traceability.production_lot_usage')
    .where('lot_tracking_id', lotId)
    .orderBy('created_at', 'asc');

  const reportIds = [...new Set(usages.map(u => u.production_report_id))];
  const reports = reportIds.length
    ? await db('production.reports').whereIn('id', reportIds)
    : [];

  // Reports → Orders
  const orderIds = [...new Set(reports.filter(r => r.order_id).map(r => r.order_id))];
  const orders = orderIds.length
    ? await db('production.orders').whereIn('id', orderIds)
    : [];

  // Build tree
  return {
    type: 'lot',
    data: lot,
    children: reports.map(report => ({
      type: 'report',
      data: report,
      quantity_used: usages.find(u => u.production_report_id === report.id)?.quantity_used,
      children: orders.filter(o => o.id === report.order_id).map(order => ({
        type: 'order',
        data: order,
        children: [],
      })),
    })),
  };
}

// ─── Backward Trace: Order → Reports → Lots → Suppliers ────────────────

export async function backwardTrace(orderId) {
  const order = await db('production.orders').where('id', orderId).first();
  if (!order) return null;

  const reports = await db('production.reports').where('order_id', orderId);
  const reportIds = reports.map(r => r.id);

  const usages = reportIds.length
    ? await db('traceability.production_lot_usage').whereIn('production_report_id', reportIds)
    : [];

  const lotIds = [...new Set(usages.map(u => u.lot_tracking_id))];
  const lots = lotIds.length
    ? await db('traceability.lot_tracking').whereIn('id', lotIds)
    : [];

  // Try to get supplier info
  const supplierIds = [...new Set(lots.filter(l => l.supplier_id).map(l => l.supplier_id))];
  let suppliers = [];
  try {
    suppliers = supplierIds.length
      ? await db('companies.companies').whereIn('id', supplierIds)
      : [];
  } catch (e) { /* companies table may not exist */ }

  return {
    type: 'order',
    data: order,
    children: reports.map(report => ({
      type: 'report',
      data: report,
      children: lots
        .filter(l => usages.some(u => u.lot_tracking_id === l.id && u.production_report_id === report.id))
        .map(lot => ({
          type: 'lot',
          data: lot,
          quantity_used: usages.find(u => u.lot_tracking_id === lot.id && u.production_report_id === report.id)?.quantity_used,
          children: suppliers.filter(s => s.id === lot.supplier_id).map(s => ({
            type: 'supplier',
            data: s,
            children: [],
          })),
        })),
    })),
  };
}

// ─── Backward Trace by Serial Number ────────────────────────────────────

export async function backwardTraceSerial(serialNumber) {
  const serial = await db('traceability.serial_numbers')
    .where('serial_number', serialNumber)
    .first();
  if (!serial) return null;

  let report = null;
  if (serial.production_report_id) {
    report = await db('production.reports').where('id', serial.production_report_id).first();
  }

  // Get lots from the serial's lot_tracking_ids or from report usage
  let lotIds = [];
  if (Array.isArray(serial.lot_tracking_ids) && serial.lot_tracking_ids.length) {
    lotIds = serial.lot_tracking_ids;
  } else if (serial.production_report_id) {
    const usages = await db('traceability.production_lot_usage')
      .where('production_report_id', serial.production_report_id);
    lotIds = usages.map(u => u.lot_tracking_id);
  }

  const lots = lotIds.length
    ? await db('traceability.lot_tracking').whereIn('id', lotIds)
    : [];

  const supplierIds = [...new Set(lots.filter(l => l.supplier_id).map(l => l.supplier_id))];
  let suppliers = [];
  try {
    suppliers = supplierIds.length
      ? await db('companies.companies').whereIn('id', supplierIds)
      : [];
  } catch (e) { /* ignore */ }

  return {
    type: 'serial',
    data: serial,
    children: report ? [{
      type: 'report',
      data: report,
      children: lots.map(lot => ({
        type: 'lot',
        data: lot,
        children: suppliers.filter(s => s.id === lot.supplier_id).map(s => ({
          type: 'supplier',
          data: s,
          children: [],
        })),
      })),
    }] : lots.map(lot => ({
      type: 'lot',
      data: lot,
      children: suppliers.filter(s => s.id === lot.supplier_id).map(s => ({
        type: 'supplier',
        data: s,
        children: [],
      })),
    })),
  };
}
