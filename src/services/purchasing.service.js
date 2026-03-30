import db from '../config/db.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function err(msg, code = 400) {
  const e = new Error(msg);
  e.statusCode = code;
  throw e;
}

function recalcTotal(lines) {
  return lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unit_price), 0);
}

// ── PO Number ────────────────────────────────────────────────────────────────

export async function nextPoNumber() {
  const year = new Date().getFullYear();
  const [{ nextval }] = await db.raw("SELECT nextval('purchasing.po_seq') AS nextval");
  return `PO-${year}-${String(nextval).padStart(5, '0')}`;
}

// ── Create PO ────────────────────────────────────────────────────────────────

export async function createPO(data, userId) {
  return db.transaction(async (trx) => {
    const poNumber = data.poNumber || await nextPoNumber();

    const [po] = await trx('purchasing.purchase_orders').insert({
      po_number: poNumber,
      supplier_id: data.supplierId,
      supplier_contact_id: data.supplierContactId || null,
      status: 'draft',
      currency: data.currency || 'RON',
      notes: data.notes || null,
      tenant_id: data.tenantId || null,
      created_by: userId,
    }).returning('*');

    if (data.lines && data.lines.length > 0) {
      const lineRows = data.lines.map((l) => ({
        po_id: po.id,
        item_id: l.itemId || null,
        description: l.description || null,
        quantity: l.quantity,
        unit: l.unit || 'buc',
        unit_price: l.unitPrice,
        notes: l.notes || null,
      }));
      await trx('purchasing.purchase_order_lines').insert(lineRows);
    }

    // Recalculate total
    const lines = await trx('purchasing.purchase_order_lines').where({ po_id: po.id });
    const total = recalcTotal(lines);
    await trx('purchasing.purchase_orders').where({ id: po.id }).update({ total_amount: total });

    return { ...po, total_amount: total };
  });
}

// ── List POs (paginated) ─────────────────────────────────────────────────────

export async function listPOs({ status, supplierId, page = 1, limit = 25 } = {}) {
  const offset = (page - 1) * limit;
  let q = db('purchasing.purchase_orders as po')
    .leftJoin('companies.companies as c', 'po.supplier_id', 'c.id')
    .select('po.*', 'c.name as supplier_name')
    .orderBy('po.created_at', 'desc');

  if (status) q = q.where('po.status', status);
  if (supplierId) q = q.where('po.supplier_id', supplierId);

  const countQ = q.clone().clearSelect().clearOrder().count('po.id as count');
  const [{ count }] = await countQ;
  const data = await q.limit(limit).offset(offset);

  return { data, total: Number(count), page, limit };
}

// ── Get single PO with lines + receipts ──────────────────────────────────────

export async function getPO(id) {
  const po = await db('purchasing.purchase_orders as po')
    .leftJoin('companies.companies as c', 'po.supplier_id', 'c.id')
    .leftJoin('companies.contacts as ct', 'po.supplier_contact_id', 'ct.id')
    .where('po.id', id)
    .select('po.*', 'c.name as supplier_name', 'ct.full_name as contact_name')
    .first();
  if (!po) err('Comanda de achizitie negasita.', 404);

  const lines = await db('purchasing.purchase_order_lines as l')
    .leftJoin('inventory.items as i', 'l.item_id', 'i.id')
    .where('l.po_id', id)
    .select('l.*', 'i.code as item_code', 'i.name as item_name');

  const receipts = await db('purchasing.po_receipts')
    .where({ po_id: id })
    .orderBy('received_at', 'desc');

  return { ...po, lines, receipts };
}

// ── Update PO header ─────────────────────────────────────────────────────────

export async function updatePO(id, data) {
  const po = await db('purchasing.purchase_orders').where({ id }).first();
  if (!po) err('Comanda negasita.', 404);
  if (po.status === 'cancelled') err('Comanda anulata nu poate fi modificata.');

  const updates = {};
  if (data.supplierId !== undefined) updates.supplier_id = data.supplierId;
  if (data.supplierContactId !== undefined) updates.supplier_contact_id = data.supplierContactId;
  if (data.currency !== undefined) updates.currency = data.currency;
  if (data.notes !== undefined) updates.notes = data.notes;
  updates.updated_at = new Date();

  const [updated] = await db('purchasing.purchase_orders').where({ id }).update(updates).returning('*');
  return updated;
}

// ── Lines CRUD ───────────────────────────────────────────────────────────────

export async function addLine(poId, lineData) {
  const po = await db('purchasing.purchase_orders').where({ id: poId }).first();
  if (!po) err('Comanda negasita.', 404);
  if (!['draft', 'confirmed'].includes(po.status)) err('Linii pot fi adaugate doar in comenzi draft sau confirmate.');

  const [line] = await db('purchasing.purchase_order_lines').insert({
    po_id: poId,
    item_id: lineData.itemId || null,
    description: lineData.description || null,
    quantity: lineData.quantity,
    unit: lineData.unit || 'buc',
    unit_price: lineData.unitPrice,
    notes: lineData.notes || null,
  }).returning('*');

  // Recalculate total
  const lines = await db('purchasing.purchase_order_lines').where({ po_id: poId });
  const total = recalcTotal(lines);
  await db('purchasing.purchase_orders').where({ id: poId }).update({ total_amount: total, updated_at: new Date() });

  return line;
}

export async function updateLine(lineId, data) {
  const line = await db('purchasing.purchase_order_lines').where({ id: lineId }).first();
  if (!line) err('Linia negasita.', 404);

  const updates = {};
  if (data.itemId !== undefined) updates.item_id = data.itemId;
  if (data.description !== undefined) updates.description = data.description;
  if (data.quantity !== undefined) updates.quantity = data.quantity;
  if (data.unit !== undefined) updates.unit = data.unit;
  if (data.unitPrice !== undefined) updates.unit_price = data.unitPrice;
  if (data.notes !== undefined) updates.notes = data.notes;

  const [updated] = await db('purchasing.purchase_order_lines').where({ id: lineId }).update(updates).returning('*');

  // Recalculate total
  const lines = await db('purchasing.purchase_order_lines').where({ po_id: line.po_id });
  const total = recalcTotal(lines);
  await db('purchasing.purchase_orders').where({ id: line.po_id }).update({ total_amount: total, updated_at: new Date() });

  return updated;
}

export async function removeLine(lineId) {
  const line = await db('purchasing.purchase_order_lines').where({ id: lineId }).first();
  if (!line) err('Linia negasita.', 404);

  await db('purchasing.purchase_order_lines').where({ id: lineId }).delete();

  // Recalculate total
  const lines = await db('purchasing.purchase_order_lines').where({ po_id: line.po_id });
  const total = recalcTotal(lines);
  await db('purchasing.purchase_orders').where({ id: line.po_id }).update({ total_amount: total, updated_at: new Date() });
}

// ── Status transitions ───────────────────────────────────────────────────────

export async function sendPO(id) {
  const po = await db('purchasing.purchase_orders').where({ id }).first();
  if (!po) err('Comanda negasita.', 404);
  if (po.status !== 'draft') err('Doar comenzile draft pot fi trimise.');

  const [updated] = await db('purchasing.purchase_orders').where({ id }).update({
    status: 'sent',
    sent_at: new Date(),
    updated_at: new Date(),
  }).returning('*');
  return updated;
}

export async function confirmPO(id, { confirmedDeliveryDate } = {}) {
  const po = await db('purchasing.purchase_orders').where({ id }).first();
  if (!po) err('Comanda negasita.', 404);
  if (po.status !== 'sent') err('Doar comenzile trimise pot fi confirmate.');

  const [updated] = await db('purchasing.purchase_orders').where({ id }).update({
    status: 'confirmed',
    confirmed_at: new Date(),
    confirmed_delivery_date: confirmedDeliveryDate || null,
    updated_at: new Date(),
  }).returning('*');
  return updated;
}

export async function receiveLines(poId, receipts, userId) {
  return db.transaction(async (trx) => {
    const po = await trx('purchasing.purchase_orders').where({ id: poId }).first();
    if (!po) err('Comanda negasita.', 404);
    if (!['confirmed', 'partially_received'].includes(po.status)) {
      err('Receptia este permisa doar pe comenzi confirmate sau partial receptionate.');
    }

    const created = [];
    for (const r of receipts) {
      const line = await trx('purchasing.purchase_order_lines').where({ id: r.poLineId, po_id: poId }).first();
      if (!line) err(`Linia ${r.poLineId} negasita in aceasta comanda.`);

      const newReceived = Number(line.quantity_received) + Number(r.receivedQty);
      if (newReceived > Number(line.quantity)) {
        err(`Cantitatea receptionata (${newReceived}) depaseste cantitatea comandata (${line.quantity}).`);
      }

      // Create receipt record
      const [receipt] = await trx('purchasing.po_receipts').insert({
        po_id: poId,
        po_line_id: r.poLineId,
        received_qty: r.receivedQty,
        received_by: userId,
        notes: r.notes || null,
        inventory_movement_id: r.inventoryMovementId || null,
      }).returning('*');

      // Update qty_received on line
      await trx('purchasing.purchase_order_lines').where({ id: r.poLineId }).update({
        quantity_received: newReceived,
      });

      created.push(receipt);
    }

    // Check if all lines are fully received
    const allLines = await trx('purchasing.purchase_order_lines').where({ po_id: poId });
    const fullyReceived = allLines.every((l) => Number(l.quantity_received) >= Number(l.quantity));
    const anyReceived = allLines.some((l) => Number(l.quantity_received) > 0);

    const newStatus = fullyReceived ? 'received' : anyReceived ? 'partially_received' : po.status;
    await trx('purchasing.purchase_orders').where({ id: poId }).update({
      status: newStatus,
      updated_at: new Date(),
    });

    return { receipts: created, status: newStatus };
  });
}

export async function cancelPO(id) {
  const po = await db('purchasing.purchase_orders').where({ id }).first();
  if (!po) err('Comanda negasita.', 404);
  if (po.status === 'received') err('Comenzile complet receptionate nu pot fi anulate.');
  if (po.status === 'cancelled') err('Comanda este deja anulata.');

  const [updated] = await db('purchasing.purchase_orders').where({ id }).update({
    status: 'cancelled',
    updated_at: new Date(),
  }).returning('*');
  return updated;
}

// ── Deficit items for auto-PO generation ─────────────────────────────────────

export async function getDeficitItems() {
  const rows = await db('inventory.items as i')
    .leftJoin('inventory.stock_levels as sl', 'i.id', 'sl.item_id')
    .leftJoin('inventory.item_suppliers as isup', function () {
      this.on('isup.item_id', 'i.id').andOn('isup.is_primary', db.raw('true'));
    })
    .leftJoin('companies.companies as c', 'isup.supplier_company_id', 'c.id')
    .whereRaw('COALESCE(sl.current_qty, 0) < i.min_stock')
    .where('i.is_active', true)
    .select(
      'i.id as item_id',
      'i.code as item_code',
      'i.name as item_name',
      'i.unit',
      'i.min_stock',
      db.raw('COALESCE(sl.current_qty, 0) as current_qty'),
      db.raw('i.min_stock - COALESCE(sl.current_qty, 0) as deficit'),
      db.raw('COALESCE(i.reorder_qty, i.min_stock - COALESCE(sl.current_qty, 0)) as suggested_qty'),
      'isup.supplier_company_id as supplier_id',
      'c.name as supplier_name',
      'isup.unit_cost',
      'isup.currency',
    )
    .orderBy('i.name');

  return rows;
}
