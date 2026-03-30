import db from '../config/db.js';

// ─── Shipment Number ────────────────────────────────────────────────────

export async function nextShipmentNumber() {
  const year = new Date().getFullYear();
  const [{ nextval }] = await db.raw(`SELECT nextval('shipments.shipment_number_seq') AS nextval`);
  const seq = String(nextval).padStart(5, '0');
  return `EXP-${year}-${seq}`;
}

// ─── Create ─────────────────────────────────────────────────────────────

export async function createShipment(data, userId) {
  const shipmentNumber = await nextShipmentNumber();
  const [shipment] = await db('shipments.shipments').insert({
    shipment_number: shipmentNumber,
    order_id: data.order_id || null,
    client_company_id: data.client_company_id || null,
    status: 'preparing',
    quantity_shipped: data.quantity_shipped || 0,
    is_partial: data.is_partial || false,
    delivery_address: data.delivery_address || null,
    transport_type: data.transport_type || 'own',
    transporter_company_id: data.transporter_company_id || null,
    vehicle_number: data.vehicle_number || null,
    driver_name: data.driver_name || null,
    notes: data.notes || null,
    tenant_id: data.tenant_id || null,
    created_by: userId || null,
  }).returning('*');
  return shipment;
}

// ─── List ───────────────────────────────────────────────────────────────

export async function listShipments({ orderId, status, page = 1, limit = 50 } = {}) {
  let q = db('shipments.shipments');
  if (orderId) q = q.where('order_id', orderId);
  if (status) q = q.where('status', status);
  const [{ count }] = await q.clone().count('* as count');
  const data = await q.clone().orderBy('created_at', 'desc').limit(limit).offset((page - 1) * limit);
  return { data, total: Number(count), page: Number(page), limit: Number(limit) };
}

// ─── Detail ─────────────────────────────────────────────────────────────

export async function getShipment(id) {
  const shipment = await db('shipments.shipments').where('id', id).first();
  if (!shipment) return null;
  const packages = await db('shipments.shipment_packages')
    .where('shipment_id', id)
    .orderBy('package_number', 'asc');
  const documents = await db('shipments.shipment_documents')
    .where('shipment_id', id)
    .orderBy('generated_at', 'desc');
  return { ...shipment, packages, documents };
}

// ─── Add Package ────────────────────────────────────────────────────────

export async function addPackage(shipmentId, data) {
  // Determine next package number
  const [{ max }] = await db('shipments.shipment_packages')
    .where('shipment_id', shipmentId)
    .max('package_number as max');
  const nextNumber = (max || 0) + 1;

  const [pkg] = await db('shipments.shipment_packages').insert({
    shipment_id: shipmentId,
    package_number: nextNumber,
    package_type: data.package_type || 'cutie',
    quantity_in_package: data.quantity_in_package || 0,
    gross_weight_kg: data.gross_weight_kg || null,
    net_weight_kg: data.net_weight_kg || null,
    dimensions: data.dimensions || null,
    barcode_id: data.barcode_id || null,
    notes: data.notes || null,
  }).returning('*');
  return pkg;
}

// ─── Dispatch ───────────────────────────────────────────────────────────

export async function dispatch(id) {
  const shipment = await db('shipments.shipments').where('id', id).first();
  if (!shipment) throw new Error('Expeditia nu a fost gasita');
  if (shipment.status !== 'preparing') {
    throw new Error('Doar expeditiile in pregatire pot fi expediate');
  }
  const [updated] = await db('shipments.shipments').where('id', id).update({
    status: 'dispatched',
    dispatched_at: db.fn.now(),
    updated_at: db.fn.now(),
  }).returning('*');
  return updated;
}

// ─── Confirm Delivery ───────────────────────────────────────────────────

export async function confirmDelivery(id, { deliveredAt, confirmedBy } = {}) {
  const shipment = await db('shipments.shipments').where('id', id).first();
  if (!shipment) throw new Error('Expeditia nu a fost gasita');
  if (shipment.status !== 'dispatched' && shipment.status !== 'in_transit') {
    throw new Error('Doar expeditiile expediate pot fi confirmate ca livrate');
  }
  const [updated] = await db('shipments.shipments').where('id', id).update({
    status: 'delivered',
    delivered_at: deliveredAt || db.fn.now(),
    delivery_confirmed_by: confirmedBy || null,
    updated_at: db.fn.now(),
  }).returning('*');
  return updated;
}

// ─── Order Shipments (progress) ─────────────────────────────────────────

export async function getOrderShipments(orderId) {
  const shipments = await db('shipments.shipments')
    .where('order_id', orderId)
    .whereNot('status', 'cancelled')
    .orderBy('created_at', 'desc');

  const totalShipped = shipments.reduce((sum, s) => sum + (s.quantity_shipped || 0), 0);

  // Try to get the ordered quantity from work_orders
  let totalOrdered = 0;
  try {
    const order = await db('production.work_orders').where('id', orderId).first();
    if (order) totalOrdered = order.quantity || order.qty_planned || 0;
  } catch {
    // table might not exist or different structure
  }

  return {
    order_id: orderId,
    total_ordered: totalOrdered,
    total_shipped: totalShipped,
    remaining: Math.max(0, totalOrdered - totalShipped),
    shipments,
  };
}

// ─── Cancel ─────────────────────────────────────────────────────────────

export async function cancel(id) {
  const shipment = await db('shipments.shipments').where('id', id).first();
  if (!shipment) throw new Error('Expeditia nu a fost gasita');
  if (shipment.status === 'delivered') {
    throw new Error('Nu se poate anula o expeditie deja livrata');
  }
  const [updated] = await db('shipments.shipments').where('id', id).update({
    status: 'cancelled',
    updated_at: db.fn.now(),
  }).returning('*');
  return updated;
}
