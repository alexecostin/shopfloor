import db from '../config/db.js';

const TABLE = 'production.work_instructions';

function notFound(message, code) {
  const err = new Error(message);
  err.statusCode = 404;
  err.code = code;
  return err;
}

// ── list ────────────────────────────────────────────────────────────────────
export async function list({ productId, operationId, machineType, machineId, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  let q = db(TABLE);

  if (productId) q = q.where({ product_id: productId });
  if (operationId) q = q.where({ operation_id: operationId });
  if (machineType) q = q.where({ machine_type: machineType });
  if (machineId) q = q.where({ machine_id: machineId });

  const [{ count }] = await q.clone().count('id as count');
  const data = await q
    .leftJoin('bom.products as bp', 'bp.id', `${TABLE}.product_id`)
    .leftJoin('bom.operations as bo', 'bo.id', `${TABLE}.operation_id`)
    .select(
      `${TABLE}.*`,
      'bp.name as product_name',
      'bp.reference as product_reference',
      'bo.operation_name as operation_name',
    )
    .orderBy(`${TABLE}.updated_at`, 'desc')
    .limit(limit)
    .offset(offset);

  return {
    data,
    pagination: { page, limit, total: Number(count), pages: Math.ceil(count / limit) },
  };
}

// ── getById ─────────────────────────────────────────────────────────────────
export async function getById(id) {
  const item = await db(TABLE)
    .leftJoin('bom.products as bp', 'bp.id', `${TABLE}.product_id`)
    .leftJoin('bom.operations as bo', 'bo.id', `${TABLE}.operation_id`)
    .select(
      `${TABLE}.*`,
      'bp.name as product_name',
      'bp.reference as product_reference',
      'bo.operation_name as operation_name',
    )
    .where(`${TABLE}.id`, id)
    .first();
  if (!item) throw notFound('Instructiunea de lucru nu a fost gasita.', 'WI_NEGASITA');
  return item;
}

// ── create ──────────────────────────────────────────────────────────────────
export async function create(data, userId) {
  const row = {
    product_id: data.productId || null,
    operation_id: data.operationId || null,
    machine_type: data.machineType || null,
    machine_id: data.machineId || null,
    title: data.title,
    drawing_url: data.drawingUrl || null,
    parameters: JSON.stringify(data.parameters || []),
    attention_points: JSON.stringify(data.attentionPoints || []),
    tolerances: JSON.stringify(data.tolerances || []),
    video_url: data.videoUrl || null,
    notes: data.notes || null,
    revision: data.revision || 1,
    is_active: data.isActive !== false,
    tenant_id: data.tenantId || null,
    created_by: userId || null,
  };
  const [item] = await db(TABLE).insert(row).returning('*');
  return item;
}

// ── update ──────────────────────────────────────────────────────────────────
export async function update(id, data) {
  const existing = await db(TABLE).where({ id }).first();
  if (!existing) throw notFound('Instructiunea de lucru nu a fost gasita.', 'WI_NEGASITA');

  const updates = { updated_at: new Date() };

  if (data.productId !== undefined) updates.product_id = data.productId || null;
  if (data.operationId !== undefined) updates.operation_id = data.operationId || null;
  if (data.machineType !== undefined) updates.machine_type = data.machineType || null;
  if (data.machineId !== undefined) updates.machine_id = data.machineId || null;
  if (data.title !== undefined) updates.title = data.title;
  if (data.drawingUrl !== undefined) updates.drawing_url = data.drawingUrl || null;
  if (data.parameters !== undefined) updates.parameters = JSON.stringify(data.parameters);
  if (data.attentionPoints !== undefined) updates.attention_points = JSON.stringify(data.attentionPoints);
  if (data.tolerances !== undefined) updates.tolerances = JSON.stringify(data.tolerances);
  if (data.videoUrl !== undefined) updates.video_url = data.videoUrl || null;
  if (data.notes !== undefined) updates.notes = data.notes || null;
  if (data.revision !== undefined) updates.revision = data.revision;
  if (data.isActive !== undefined) updates.is_active = data.isActive;

  const [item] = await db(TABLE).where({ id }).update(updates).returning('*');
  return item;
}

// ── getForOperator ──────────────────────────────────────────────────────────
// Smart lookup: given a machineId and orderId, find the most specific instruction
export async function getForOperator(machineId, orderId) {
  // 1. Get the order's product_reference (product_code)
  const order = await db('production.orders').where({ id: orderId }).first();
  if (!order) throw notFound('Comanda nu a fost gasita.', 'COMANDA_NEGASITA');

  const productCode = order.product_code || null;

  // 2. Find product in bom.products by reference
  let product = null;
  if (productCode) {
    product = await db('bom.products').where({ reference: productCode }).first();
  }

  // 3. Get the machine to know its type
  let machine = null;
  if (machineId) {
    machine = await db('machines.machines').where({ id: machineId }).first();
  }

  // 4. Find all active instructions that could match
  let q = db(TABLE).where({ is_active: true });

  const conditions = [];
  if (machineId) conditions.push(db.raw('machine_id = ?', [machineId]));
  if (product) {
    conditions.push(db.raw('product_id = ?', [product.id]));
  }
  if (machine?.type) {
    conditions.push(db.raw('machine_type = ?', [machine.type]));
  }
  // Also include generic instructions (no machine_id, no product_id, no machine_type)
  conditions.push(db.raw('(machine_id IS NULL AND product_id IS NULL AND machine_type IS NULL)'));

  if (conditions.length > 0) {
    q = q.where(function () {
      conditions.forEach((cond, i) => {
        if (i === 0) this.whereRaw(cond.sql, cond.bindings);
        else this.orWhereRaw(cond.sql, cond.bindings);
      });
    });
  }

  const candidates = await q;

  if (candidates.length === 0) return null;

  // 5. Sort by specificity: machine_id > product_id + operation_id > machine_type > generic
  const scored = candidates.map(c => {
    let score = 0;
    if (c.machine_id && c.machine_id === machineId) score += 100;
    if (c.product_id && product && c.product_id === product.id) score += 50;
    if (c.operation_id) score += 25;
    if (c.machine_type && machine?.type && c.machine_type === machine.type) score += 10;
    return { ...c, _score: score };
  });

  scored.sort((a, b) => b._score - a._score);

  return scored[0];
}
