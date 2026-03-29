import db from '../../config/db.js';
import { sendNotification } from '../../services/email.service.js';

// Movement sign determination
const POSITIVE_TYPES = new Set(['receipt', 'production_output', 'adjustment_plus', 'return_supplier']);

function signedQty(movementType, qty) {
  return POSITIVE_TYPES.has(movementType) ? Math.abs(qty) : -Math.abs(qty);
}

// Document number prefixes
const DOC_PREFIXES = {
  receipt_note: { prefix: 'NIR', seq: 'inventory.nir_seq' },
  issue_note: { prefix: 'BC', seq: 'inventory.bc_seq' },
  transfer_note: { prefix: 'TR', seq: 'inventory.tr_seq' },
  return_note: { prefix: 'RN', seq: 'inventory.nir_seq' },
};

// Movement type per document type
const DOC_MOVEMENT_TYPE = {
  receipt_note: 'receipt',
  issue_note: 'production_input',
  transfer_note: 'transfer',
  return_note: 'return_supplier',
};

// ─── Items ────────────────────────────────────────────────────────────────────

export async function listItems({ page = 1, limit = 50, category, search, belowMin } = {}) {
  const offset = (page - 1) * limit;
  let q = db('inventory.items as i')
    .leftJoin('inventory.stock_levels as sl', 'i.id', 'sl.item_id')
    .select('i.*', 'sl.current_qty', 'sl.reserved_qty',
      db.raw('COALESCE(sl.current_qty, 0) - COALESCE(sl.reserved_qty, 0) AS available_qty'))
    .orderBy('i.name');
  if (category) q = q.where('i.category', category);
  if (search) q = q.where((b) => b.where('i.code', 'ilike', `%${search}%`).orWhere('i.name', 'ilike', `%${search}%`));
  if (belowMin === 'true' || belowMin === true) q = q.whereRaw('COALESCE(sl.current_qty, 0) <= i.min_stock');
  const [{ count }] = await q.clone().count('i.id as count');
  const data = await q.limit(limit).offset(offset);
  return { data, total: Number(count), page, limit };
}

export async function createItem(data, userId) {
  return db.transaction(async (trx) => {
    const [item] = await trx('inventory.items').insert({
      code: data.code,
      name: data.name,
      category: data.category,
      unit: data.unit || 'buc',
      product_id: data.productId,
      supplier_name: data.supplierName,
      supplier_code: data.supplierCode,
      min_stock: data.minStock || 0,
      max_stock: data.maxStock,
      reorder_qty: data.reorderQty,
      lead_time_days: data.leadTimeDays,
      location: data.location,
      weight_per_unit_kg: data.weightPerUnitKg,
      cost_per_unit: data.costPerUnit,
      is_active: data.isActive !== false,
    }).returning('*');
    await trx('inventory.stock_levels').insert({ item_id: item.id, current_qty: 0, reserved_qty: 0 });
    return item;
  });
}

export async function updateItem(id, data) {
  const row = {};
  const map = {
    name: 'name', category: 'category', unit: 'unit', productId: 'product_id',
    supplierName: 'supplier_name', supplierCode: 'supplier_code', minStock: 'min_stock',
    maxStock: 'max_stock', reorderQty: 'reorder_qty', leadTimeDays: 'lead_time_days',
    location: 'location', weightPerUnitKg: 'weight_per_unit_kg', costPerUnit: 'cost_per_unit',
    isActive: 'is_active',
  };
  for (const [k, v] of Object.entries(map)) {
    if (data[k] !== undefined) row[v] = data[k];
  }
  row.updated_at = new Date();
  const [item] = await db('inventory.items').where({ id }).update(row).returning('*');
  return item;
}

// ─── Stock Levels ─────────────────────────────────────────────────────────────

export async function listStockLevels() {
  return db('inventory.stock_levels as sl')
    .join('inventory.items as i', 'sl.item_id', 'i.id')
    .select('sl.*', 'i.code', 'i.name', 'i.unit', 'i.min_stock', 'i.max_stock', 'i.category')
    .orderBy('i.name');
}

export async function getAlerts() {
  const [belowMin, aboveMax] = await Promise.all([
    db('inventory.items as i')
      .join('inventory.stock_levels as sl', 'i.id', 'sl.item_id')
      .select('i.*', 'sl.current_qty')
      .whereRaw('sl.current_qty <= i.min_stock')
      .where('i.is_active', true),
    db('inventory.items as i')
      .join('inventory.stock_levels as sl', 'i.id', 'sl.item_id')
      .select('i.*', 'sl.current_qty')
      .whereNotNull('i.max_stock')
      .whereRaw('sl.current_qty > i.max_stock')
      .where('i.is_active', true),
  ]);
  return { belowMin, aboveMax, totalAlerts: belowMin.length + aboveMax.length };
}

// ─── Movements ────────────────────────────────────────────────────────────────

export async function listMovements({ itemId, type, from, to } = {}) {
  let q = db('inventory.movements').orderBy('created_at', 'desc').limit(200);
  if (itemId) q = q.where('item_id', itemId);
  if (type) q = q.where('movement_type', type);
  if (from) q = q.where('created_at', '>=', from);
  if (to) q = q.where('created_at', '<=', to);
  return q;
}

export async function createMovement(data, userId) {
  const item = await db('inventory.items').where({ id: data.itemId }).first();
  if (!item) throw Object.assign(new Error('Articol negasit.'), { status: 404 });

  const signed = signedQty(data.movementType, data.qty);

  return db.transaction(async (trx) => {
    const [stock] = await trx('inventory.stock_levels').where({ item_id: data.itemId }).forUpdate();
    const newQty = Number(stock?.current_qty || 0) + signed;
    if (newQty < 0) throw Object.assign(new Error('Stoc insuficient.'), { status: 400 });

    const [movement] = await trx('inventory.movements').insert({
      item_id: data.itemId,
      movement_type: data.movementType,
      qty: signed,
      reference_type: data.referenceType,
      reference_id: data.referenceId,
      reference_number: data.referenceNumber,
      lot_number: data.lotNumber,
      supplier_name: data.supplierName,
      unit_cost: data.unitCost,
      total_cost: data.unitCost ? Math.abs(signed) * data.unitCost : null,
      location: data.location,
      performed_by: userId,
      notes: data.notes,
    }).returning('*');

    await trx('inventory.stock_levels')
      .where({ item_id: data.itemId })
      .update({ current_qty: newQty, last_movement_at: new Date(), updated_at: new Date() });

    // Notify if below minimum stock
    if (newQty <= item.min_stock) {
      sendNotification({ type: 'stock_low', data: { itemName: item.name, currentQty: newQty, minStock: item.min_stock } }).catch(() => {});
    }

    return movement;
  });
}

// ─── Material Requirements ────────────────────────────────────────────────────

export async function listRequirements({ status, planDate } = {}) {
  let q = db('inventory.material_requirements').orderBy('calculated_at', 'desc');
  if (status) q = q.where('status', status);
  if (planDate) q = q.where('plan_date', planDate);
  return q;
}

export async function calculateRequirements(orderIds) {
  let ordersQ = db('production.orders').where('status', 'active');
  if (orderIds?.length) ordersQ = ordersQ.whereIn('id', orderIds);
  const orders = await ordersQ;

  const requirements = [];
  for (const order of orders) {
    const product = await db('bom.products')
      .where('reference', order.product_code)
      .orWhere('name', 'ilike', order.product_name)
      .first();
    if (!product) continue;

    const bomMaterials = await db('bom.materials').where({ product_id: product.id });
    for (const bm of bomMaterials) {
      const requiredQty = order.target_quantity * bm.qty_per_piece * (bm.waste_factor || 1);
      const stockItem = await db('inventory.items').where('code', bm.material_code).orWhere('name', bm.material_name).first();
      const stockLevel = stockItem ? await db('inventory.stock_levels').where({ item_id: stockItem.id }).first() : null;
      const availableQty = Number(stockLevel?.current_qty || 0);
      const shortageQty = Math.max(requiredQty - availableQty, 0);

      requirements.push({
        order_id: order.id,
        product_reference: order.product_code,
        product_name: order.product_name,
        material_code: bm.material_code,
        material_name: bm.material_name,
        required_qty: requiredQty,
        available_qty: availableQty,
        shortage_qty: shortageQty,
        unit: bm.unit,
        calculated_at: new Date(),
      });
    }
  }

  // Replace calculated requirements
  await db('inventory.material_requirements').where('status', 'calculated').delete();
  if (requirements.length) await db('inventory.material_requirements').insert(requirements);
  return requirements;
}

// ─── Warehouse Documents ──────────────────────────────────────────────────────

export async function listDocuments({ type, status } = {}) {
  let q = db('inventory.warehouse_documents').orderBy('created_at', 'desc');
  if (type) q = q.where('document_type', type);
  if (status) q = q.where('status', status);
  return q;
}

export async function getDocument(id) {
  const doc = await db('inventory.warehouse_documents').where({ id }).first();
  if (!doc) return null;
  const lines = await db('inventory.warehouse_document_lines').where({ document_id: id });
  return { ...doc, lines };
}

async function nextDocNumber(trx, docType) {
  const { prefix, seq } = DOC_PREFIXES[docType] || { prefix: 'DOC', seq: 'inventory.nir_seq' };
  const [{ nextval }] = await trx.raw(`SELECT nextval('${seq}')`);
  return `${prefix}-${String(nextval).padStart(5, '0')}`;
}

export async function createDocument(data, userId) {
  return db.transaction(async (trx) => {
    const docNumber = await nextDocNumber(trx, data.documentType);
    const [doc] = await trx('inventory.warehouse_documents').insert({
      document_type: data.documentType,
      document_number: docNumber,
      partner_name: data.partnerName,
      notes: data.notes,
      created_by: userId,
    }).returning('*');

    const lines = await Promise.all(data.lines.map(async (l) => {
      const item = await trx('inventory.items').where({ id: l.itemId }).first();
      return {
        document_id: doc.id,
        item_id: l.itemId,
        item_code: item?.code,
        item_name: item?.name,
        qty: l.qty,
        unit: item?.unit,
        unit_cost: l.unitCost,
        total_cost: l.unitCost ? l.qty * l.unitCost : null,
        lot_number: l.lotNumber,
        notes: l.notes,
      };
    }));
    await trx('inventory.warehouse_document_lines').insert(lines);
    return { ...doc, lines };
  });
}

export async function confirmDocument(id, userId) {
  const doc = await db('inventory.warehouse_documents').where({ id }).first();
  if (!doc) throw Object.assign(new Error('Document negasit.'), { status: 404 });
  if (doc.status !== 'draft') throw Object.assign(new Error('Documentul nu este draft.'), { status: 400 });

  const lines = await db('inventory.warehouse_document_lines').where({ document_id: id });
  const movementType = DOC_MOVEMENT_TYPE[doc.document_type];

  return db.transaction(async (trx) => {
    for (const line of lines) {
      const signed = signedQty(movementType, line.qty);
      const [stock] = await trx('inventory.stock_levels').where({ item_id: line.item_id }).forUpdate();
      const newQty = Number(stock?.current_qty || 0) + signed;
      if (newQty < 0) throw Object.assign(new Error(`Stoc insuficient pentru ${line.item_name}.`), { status: 400 });

      await trx('inventory.movements').insert({
        item_id: line.item_id,
        movement_type: movementType,
        qty: signed,
        reference_type: 'warehouse_document',
        reference_id: doc.id,
        reference_number: doc.document_number,
        unit_cost: line.unit_cost,
        total_cost: line.total_cost,
        lot_number: line.lot_number,
        performed_by: userId,
      });
      await trx('inventory.stock_levels')
        .where({ item_id: line.item_id })
        .update({ current_qty: newQty, last_movement_at: new Date(), updated_at: new Date() });
    }

    const [updated] = await trx('inventory.warehouse_documents')
      .where({ id })
      .update({ status: 'confirmed', confirmed_by: userId, confirmed_at: new Date() })
      .returning('*');
    return updated;
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboard() {
  const [totalItems, alertsCount, stockValue, recentMovements] = await Promise.all([
    db('inventory.items').where('is_active', true).count('* as count').first(),
    db('inventory.items as i')
      .join('inventory.stock_levels as sl', 'i.id', 'sl.item_id')
      .whereRaw('sl.current_qty <= i.min_stock')
      .where('i.is_active', true)
      .count('* as count').first(),
    db('inventory.items as i')
      .join('inventory.stock_levels as sl', 'i.id', 'sl.item_id')
      .whereNotNull('i.cost_per_unit')
      .sum(db.raw('sl.current_qty * i.cost_per_unit as total')).first(),
    db('inventory.movements').orderBy('created_at', 'desc').limit(10),
  ]);
  return {
    totalItems: Number(totalItems?.count) || 0,
    alertsCount: Number(alertsCount?.count) || 0,
    totalStockValue: Number(stockValue?.total) || 0,
    recentMovements,
  };
}
