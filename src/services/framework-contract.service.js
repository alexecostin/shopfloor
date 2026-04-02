import db from '../config/db.js';
import { getTenantConfig } from './app-config.service.js';
import { escapeLike } from '../utils/sanitize.js';

/**
 * Framework Contracts (Contracte Cadru) service.
 * Manages long-term delivery contracts with periodic work order generation.
 */

// ── Ensure products JSONB column exists ──────────────────────────────────────

let _columnsEnsured = false;
async function ensureProductsColumn() {
  if (_columnsEnsured) return;
  try {
    await db.raw("ALTER TABLE production.framework_contracts ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'");
  } catch { /* column already exists or table doesn't exist yet */ }
  _columnsEnsured = true;
}

// ── List contracts ──────────────────────────────────────────────────────────

export async function listContracts(tenantId, status) {
  await ensureProductsColumn();
  let q = db('production.framework_contracts as fc')
    .leftJoin('companies.companies as c', 'fc.client_id', 'c.id')
    .select('fc.*', 'c.name as client_name');
  if (tenantId) q = q.where('fc.tenant_id', tenantId);
  if (status) q = q.where('fc.status', status);
  return q.orderBy('fc.created_at', 'desc');
}

// ── Create contract ─────────────────────────────────────────────────────────

export async function createContract(data) {
  await ensureProductsColumn();
  const config = await getTenantConfig(data.tenantId || null).catch(() => ({}));

  // Support multi-product contracts via products array
  const products = Array.isArray(data.products) && data.products.length > 0
    ? data.products.filter(p => p.productReference || p.productName)
    : [];

  // For backward compat, also use top-level product fields if no products array given
  const productReference = products.length > 0
    ? products.map(p => p.productReference).filter(Boolean).join(', ')
    : (data.productReference || null);
  const productName = products.length > 0
    ? products.map(p => p.productName).filter(Boolean).join(', ')
    : (data.productName || null);

  const [contract] = await db('production.framework_contracts').insert({
    client_id: data.clientId,
    contract_number: data.contractNumber,
    product_reference: productReference,
    product_name: productName,
    total_quantity: data.totalQuantity,
    unit_price: data.unitPrice || null,
    currency: data.currency || config.defaultCurrency || 'RON',
    delivery_frequency: data.deliveryFrequency, // weekly, biweekly, monthly
    quantity_per_delivery: data.quantityPerDelivery,
    start_date: data.startDate,
    end_date: data.endDate,
    status: data.status || 'active',
    notes: data.notes || null,
    tenant_id: data.tenantId || null,
    products: JSON.stringify(products),
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
    .where('order_number', 'like', `${escapeLike(contract.contract_number)}-%`)
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
  await ensureProductsColumn();
  const row = {};
  if (data.status !== undefined) row.status = data.status;
  if (data.notes !== undefined) row.notes = data.notes;
  if (data.quantityPerDelivery !== undefined) row.quantity_per_delivery = data.quantityPerDelivery;
  if (data.deliveryFrequency !== undefined) row.delivery_frequency = data.deliveryFrequency;
  if (data.endDate !== undefined) row.end_date = data.endDate;
  if (data.products !== undefined) row.products = JSON.stringify(data.products);

  const [contract] = await db('production.framework_contracts').where('id', id).update(row).returning('*');
  return contract;
}

// ── Generate next delivery order ────────────────────────────────────────────

/**
 * Generate next delivery work order from a framework contract.
 * Creates a work order for the next scheduled delivery.
 */
export async function generateNextDelivery(contractId, userId) {
  await ensureProductsColumn();
  const contract = await db('production.framework_contracts').where('id', contractId).first();
  if (!contract) return null;
  if (contract.status !== 'active') {
    const e = new Error('Doar contractele active pot genera livrari.');
    e.statusCode = 400;
    throw e;
  }

  // Parse products array
  let products = [];
  try {
    products = typeof contract.products === 'string' ? JSON.parse(contract.products) : (contract.products || []);
  } catch { products = []; }

  // Count existing orders from this contract
  const existingOrders = await db('production.work_orders')
    .where('order_number', 'like', `${escapeLike(contract.contract_number)}-%`)
    .count('* as c');
  const orderNum = Number(existingOrders[0]?.c) || 0;

  // Calculate delivery date based on frequency
  const freqDays = { weekly: 7, biweekly: 14, monthly: 30 }[contract.delivery_frequency] || 30;
  const deliveryDate = new Date(Date.now() + freqDays * 86400000);

  // If contract has multiple products, create one WO per product
  if (products.length > 1) {
    const createdOrders = [];
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const result = await db.raw("SELECT nextval('production.work_order_seq')").catch(() => ({ rows: [{ nextval: Date.now() + i }] }));
      const nextval = result.rows?.[0]?.nextval || result[0]?.nextval || (Date.now() + i);
      const woNumber = `CL-${String(nextval).padStart(5, '0')}`;
      const deliveryIdx = orderNum + i + 1;

      const [wo] = await db('production.work_orders').insert({
        work_order_number: woNumber,
        order_number: `${contract.contract_number}-${String(deliveryIdx).padStart(3, '0')}`,
        client_id: contract.client_id,
        product_reference: p.productReference || null,
        product_name: p.productName || null,
        quantity: p.quantityPerDelivery || contract.quantity_per_delivery,
        priority: 'normal',
        scheduled_end: deliveryDate.toISOString().split('T')[0],
        unit_price: p.unitPrice || contract.unit_price,
        currency: contract.currency,
        notes: `Livrare din contract cadru ${contract.contract_number} — produs ${p.productReference || p.productName || (i + 1)}`,
        created_by: userId,
      }).returning('*');
      createdOrders.push(wo);
    }
    return createdOrders;
  }

  // Single product (legacy) — create one WO
  const result = await db.raw("SELECT nextval('production.work_order_seq')").catch(() => ({ rows: [{ nextval: Date.now() }] }));
  const nextval = result.rows?.[0]?.nextval || result[0]?.nextval || Date.now();
  const woNumber = `CL-${String(nextval).padStart(5, '0')}`;

  const singleProduct = products[0] || {};
  const [wo] = await db('production.work_orders').insert({
    work_order_number: woNumber,
    order_number: `${contract.contract_number}-${String(orderNum + 1).padStart(3, '0')}`,
    client_id: contract.client_id,
    product_reference: singleProduct.productReference || contract.product_reference,
    product_name: singleProduct.productName || contract.product_name,
    quantity: singleProduct.quantityPerDelivery || contract.quantity_per_delivery,
    priority: 'normal',
    scheduled_end: deliveryDate.toISOString().split('T')[0],
    unit_price: singleProduct.unitPrice || contract.unit_price,
    currency: contract.currency,
    notes: `Livrare #${orderNum + 1} din contract cadru ${contract.contract_number}`,
    created_by: userId,
  }).returning('*');

  return wo;
}
