import db from '../config/db.js';

/**
 * Framework Contracts (Contracte Cadru) service.
 * Manages long-term delivery contracts with periodic work order generation.
 */

// ── List contracts ──────────────────────────────────────────────────────────

export async function listContracts(tenantId, status) {
  let q = db('production.framework_contracts as fc')
    .leftJoin('companies.companies as c', 'fc.client_id', 'c.id')
    .select('fc.*', 'c.name as client_name');
  if (tenantId) q = q.where('fc.tenant_id', tenantId);
  if (status) q = q.where('fc.status', status);
  return q.orderBy('fc.created_at', 'desc');
}

// ── Create contract ─────────────────────────────────────────────────────────

export async function createContract(data) {
  const [contract] = await db('production.framework_contracts').insert({
    client_id: data.clientId,
    contract_number: data.contractNumber,
    product_reference: data.productReference || null,
    product_name: data.productName || null,
    total_quantity: data.totalQuantity,
    unit_price: data.unitPrice || null,
    currency: data.currency || 'RON',
    delivery_frequency: data.deliveryFrequency, // weekly, biweekly, monthly
    quantity_per_delivery: data.quantityPerDelivery,
    start_date: data.startDate,
    end_date: data.endDate,
    status: data.status || 'active',
    notes: data.notes || null,
    tenant_id: data.tenantId || null,
  }).returning('*');
  return contract;
}

// ── Get contract detail with linked work orders ─────────────────────────────

export async function getContract(id) {
  const contract = await db('production.framework_contracts as fc')
    .leftJoin('companies.companies as c', 'fc.client_id', 'c.id')
    .where('fc.id', id)
    .select('fc.*', 'c.name as client_name')
    .first();
  if (!contract) return null;

  // Get linked work orders (generated from this contract via order_number pattern)
  const orders = await db('production.work_orders')
    .where('order_number', 'like', `${contract.contract_number}-%`)
    .orderBy('created_at', 'desc');

  // Calculate delivered quantity
  const deliveredQty = orders
    .filter(o => o.status === 'completed' || o.status === 'shipped')
    .reduce((sum, o) => sum + Number(o.quantity || 0), 0);
  const totalPlannedQty = orders.reduce((sum, o) => sum + Number(o.quantity || 0), 0);

  return { ...contract, orders, delivered_qty: deliveredQty, total_planned_qty: totalPlannedQty };
}

// ── Update contract ─────────────────────────────────────────────────────────

export async function updateContract(id, data) {
  const row = {};
  if (data.status !== undefined) row.status = data.status;
  if (data.notes !== undefined) row.notes = data.notes;
  if (data.quantityPerDelivery !== undefined) row.quantity_per_delivery = data.quantityPerDelivery;
  if (data.deliveryFrequency !== undefined) row.delivery_frequency = data.deliveryFrequency;
  if (data.endDate !== undefined) row.end_date = data.endDate;

  const [contract] = await db('production.framework_contracts').where('id', id).update(row).returning('*');
  return contract;
}

// ── Generate next delivery order ────────────────────────────────────────────

/**
 * Generate next delivery work order from a framework contract.
 * Creates a work order for the next scheduled delivery.
 */
export async function generateNextDelivery(contractId, userId) {
  const contract = await db('production.framework_contracts').where('id', contractId).first();
  if (!contract) return null;
  if (contract.status !== 'active') {
    const e = new Error('Doar contractele active pot genera livrari.');
    e.statusCode = 400;
    throw e;
  }

  // Count existing orders from this contract
  const existingOrders = await db('production.work_orders')
    .where('order_number', 'like', `${contract.contract_number}-%`)
    .count('* as c');
  const orderNum = Number(existingOrders[0]?.c) || 0;

  // Calculate delivery date based on frequency
  const freqDays = { weekly: 7, biweekly: 14, monthly: 30 }[contract.delivery_frequency] || 30;
  const deliveryDate = new Date(Date.now() + freqDays * 86400000);

  // Create work order number
  const result = await db.raw("SELECT nextval('production.work_order_seq')").catch(() => ({ rows: [{ nextval: Date.now() }] }));
  const nextval = result.rows?.[0]?.nextval || result[0]?.nextval || Date.now();
  const woNumber = `CL-${String(nextval).padStart(5, '0')}`;

  const [wo] = await db('production.work_orders').insert({
    work_order_number: woNumber,
    order_number: `${contract.contract_number}-${String(orderNum + 1).padStart(3, '0')}`,
    client_id: contract.client_id,
    product_reference: contract.product_reference,
    product_name: contract.product_name,
    quantity: contract.quantity_per_delivery,
    priority: 'normal',
    scheduled_end: deliveryDate.toISOString().split('T')[0],
    unit_price: contract.unit_price,
    currency: contract.currency,
    notes: `Livrare #${orderNum + 1} din contract cadru ${contract.contract_number}`,
    created_by: userId,
  }).returning('*');

  return wo;
}
