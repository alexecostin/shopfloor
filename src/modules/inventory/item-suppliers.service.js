import db from '../../config/db.js';
import { getTenantConfig } from '../../services/app-config.service.js';

export async function listSuppliers(itemId) {
  return db('inventory.item_suppliers as s')
    .join('companies.companies as c', 's.supplier_company_id', 'c.id')
    .leftJoin('companies.contacts as ct', 's.supplier_contact_id', 'ct.id')
    .where({ 's.item_id': itemId, 's.is_active': true })
    .orderBy(['s.is_primary', 's.priority'])
    .select('s.*', 'c.name as supplier_name', 'ct.full_name as contact_name');
}

export async function addSupplier(itemId, data) {
  // If is_primary, unset other primaries for this item
  if (data.isPrimary) {
    await db('inventory.item_suppliers').where({ item_id: itemId }).update({ is_primary: false });
  }
  const [row] = await db('inventory.item_suppliers').insert({
    item_id: itemId,
    supplier_company_id: data.supplierCompanyId,
    supplier_contact_id: data.supplierContactId || null,
    is_primary: data.isPrimary || false,
    priority: data.priority || 1,
    unit_cost: data.unitCost,
    currency: data.currency || 'RON', // default from tenant config; overridable per-supplier
    min_order_qty: data.minOrderQty || null,
    lead_time_days: data.leadTimeDays || null,
    notes: data.notes || null,
  }).onConflict(['item_id', 'supplier_company_id']).merge().returning('*');
  return row;
}

export async function updateSupplier(id, data) {
  const current = await db('inventory.item_suppliers').where({ id }).first();
  if (!current) { const e = new Error('Furnizor negasit'); e.statusCode = 404; throw e; }
  if (data.isPrimary) {
    await db('inventory.item_suppliers').where({ item_id: current.item_id }).update({ is_primary: false });
  }
  const updates = {};
  if (data.unitCost !== undefined) updates.unit_cost = data.unitCost;
  if (data.isPrimary !== undefined) updates.is_primary = data.isPrimary;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.leadTimeDays !== undefined) updates.lead_time_days = data.leadTimeDays;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.isActive !== undefined) updates.is_active = data.isActive;
  const [updated] = await db('inventory.item_suppliers').where({ id }).update(updates).returning('*');
  return updated;
}

export async function removeSupplier(id) {
  await db('inventory.item_suppliers').where({ id }).delete();
}

export async function getPurchaseHistory(itemId) {
  return db('inventory.purchase_history as p')
    .leftJoin('companies.companies as c', 'p.supplier_company_id', 'c.id')
    .where({ 'p.item_id': itemId })
    .orderBy('p.purchase_date', 'desc')
    .select('p.*', 'c.name as supplier_name');
}

export async function getPriceTrend(itemId) {
  return db('inventory.purchase_history as p')
    .leftJoin('companies.companies as c', 'p.supplier_company_id', 'c.id')
    .where({ 'p.item_id': itemId })
    .orderBy('p.purchase_date', 'asc')
    .select('p.purchase_date as date', 'p.unit_cost as unitCost', 'p.currency', 'c.name as supplierName');
}

export async function createPurchaseHistoryFromMovement(movement) {
  if (movement.type !== 'receipt' || !movement.supplier_company_id) return;

  const [existing] = await db('inventory.purchase_history')
    .where({ movement_id: movement.id }).select('id');
  if (existing) return;

  const purchaseConfig = await getTenantConfig(movement.tenant_id || null).catch(() => ({}));

  await db('inventory.purchase_history').insert({
    item_id: movement.item_id,
    supplier_company_id: movement.supplier_company_id,
    qty: Math.abs(movement.quantity),
    unit_cost: movement.unit_cost || 0,
    total_cost: Math.abs(movement.quantity) * (movement.unit_cost || 0),
    currency: purchaseConfig.defaultCurrency || 'RON',
    purchase_date: movement.created_at || new Date(),
    movement_id: movement.id,
  }).catch(() => {});

  // Check price increase alert (threshold from config)
  const priceIncreaseThreshold = (purchaseConfig.alertPriceIncreasePercent || 10) / 100;
  const history = await db('inventory.purchase_history')
    .where({ item_id: movement.item_id })
    .orderBy('purchase_date', 'desc')
    .limit(2);
  if (history.length >= 2 && history[0].unit_cost > 0) {
    const prev = parseFloat(history[1].unit_cost);
    const curr = parseFloat(history[0].unit_cost);
    if (prev > 0 && (curr - prev) / prev > priceIncreaseThreshold) {
      // Insert alert
      await db('alerts.alerts').insert({
        rule_id: null,
        tenant_id: movement.tenant_id || null,
        title: `Crestere pret material >${purchaseConfig.alertPriceIncreasePercent || 10}%`,
        message: `Pretul materialului a crescut cu ${Math.round((curr - prev) / prev * 100)}% fata de ultima achizitie`,
        severity: 'warning',
        context: JSON.stringify({ itemId: movement.item_id, prevCost: prev, newCost: curr }),
      }).catch(() => {});
    }
  }
}
