import db from '../../config/db.js';
import { getDependencyTree, calculateBackwardSchedule } from '../../services/dependency.service.js';
import { onDocumentModified } from '../../services/approval-engine.service.js';
import { escapeLike } from '../../utils/sanitize.js';

// ─── Products ────────────────────────────────────────────────────────────────

export async function listProducts({ page = 1, limit = 50, type, client, active, search, approvedOnly } = {}) {
  const offset = (page - 1) * limit;
  let q = db('bom.products');
  if (type) q = q.where('product_type', type);
  if (client) q = q.where('client_name', 'ilike', `%${escapeLike(client)}%`);
  if (active !== undefined) q = q.where('is_active', active === 'true' || active === true);
  if (search) q = q.where((b) => b.where('reference', 'ilike', `%${escapeLike(search)}%`).orWhere('name', 'ilike', `%${escapeLike(search)}%`));
  if (approvedOnly === true || approvedOnly === 'true') q = q.where('approval_status', 'active');
  const [{ count }] = await q.clone().count('* as count');
  const data = await q.clone().orderBy('reference').limit(limit).offset(offset);
  return { data, total: Number(count), page, limit };
}

export async function getProduct(id) {
  const product = await db('bom.products').where({ id }).first();
  if (!product) return null;
  const [operations, materials, components] = await Promise.all([
    db('bom.operations').where({ product_id: id }).orderBy('sequence'),
    db('bom.materials').where({ product_id: id }),
    db('bom.assembly_components').where({ parent_product_id: id }),
  ]);
  return { ...product, operations, materials, components };
}

export async function createProduct(data) {
  const row = {
    reference: data.reference,
    name: data.name,
    variant: data.variant,
    client_name: data.clientName,
    client_part_number: data.clientPartNumber,
    product_type: data.productType || 'finished',
    container_type: data.containerType,
    qty_per_container: data.qtyPerContainer,
    weight_piece_kg: data.weightPieceKg,
    weight_runner_kg: data.weightRunnerKg,
    material_type: data.materialType,
    notes: data.notes,
    is_active: data.isActive !== false,
  };
  const [product] = await db('bom.products').insert(row).returning('*');
  return product;
}

export async function updateProduct(id, data, { tenantId, userId } = {}) {
  const row = {};
  if (data.reference !== undefined) row.reference = data.reference;
  if (data.name !== undefined) row.name = data.name;
  if (data.variant !== undefined) row.variant = data.variant;
  if (data.clientName !== undefined) row.client_name = data.clientName;
  if (data.clientPartNumber !== undefined) row.client_part_number = data.clientPartNumber;
  if (data.productType !== undefined) row.product_type = data.productType;
  if (data.containerType !== undefined) row.container_type = data.containerType;
  if (data.qtyPerContainer !== undefined) row.qty_per_container = data.qtyPerContainer;
  if (data.weightPieceKg !== undefined) row.weight_piece_kg = data.weightPieceKg;
  if (data.weightRunnerKg !== undefined) row.weight_runner_kg = data.weightRunnerKg;
  if (data.materialType !== undefined) row.material_type = data.materialType;
  if (data.notes !== undefined) row.notes = data.notes;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  row.updated_at = new Date();
  // If this product is approved (active), modifying it resets it to draft and bumps version
  await onDocumentModified('mbom', id, tenantId, userId);
  const [product] = await db('bom.products').where({ id }).update(row).returning('*');
  return product;
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function listOperations(productId) {
  return db('bom.operations').where({ product_id: productId }).orderBy('sequence');
}

export async function createOperation(productId, data) {
  const ct = data.cycleTimeSeconds || data.cycle_time_seconds || null;
  const nc = data.nrCavities || data.nr_cavities || 1;
  let piecesPerHour = data.piecesPerHour || data.pieces_per_hour || null;
  if (ct && ct > 0) {
    piecesPerHour = (3600 / ct) * nc;
  }
  const row = {
    product_id: productId,
    sequence: data.sequence,
    operation_name: data.operationName || data.operation_name,
    operation_type: data.operationType || data.operation_type,
    machine_type: data.machineType || data.machine_type,
    machine_id: data.machineId || data.machine_id || null,
    cycle_time_seconds: ct,
    nr_cavities: nc,
    pieces_per_hour: piecesPerHour,
    setup_time_minutes: data.setupTimeMinutes || data.setup_time_minutes || 0,
    description: data.description,
    is_active: data.isActive !== false && data.is_active !== false,
    cnc_program: data.cncProgram || data.cnc_program || null,
    raw_material_spec: data.rawMaterialSpec || data.raw_material_spec || null,
    tools_config: JSON.stringify(data.toolsConfig || data.tools_config || []),
    machine_parameters: JSON.stringify(data.machineParameters || data.machine_parameters || []),
    consumables: JSON.stringify(data.consumables || []),
    attention_points: JSON.stringify(data.attentionPoints || data.attention_points || []),
    min_batch_before_next: data.minBatchBeforeNext || data.min_batch_before_next || null,
    transfer_type: data.transferType || data.transfer_type || null,
    transport_time_minutes: data.transportTimeMinutes || data.transport_time_minutes || 0,
    deposit_location: data.depositLocation || data.deposit_location || null,
    reject_action: data.rejectAction || data.reject_action || 'scrap',
    time_unit: data.timeUnit || data.time_unit || 'seconds',
    input_material_id: data.inputMaterialId || data.input_material_id || null,
    drawing_url: data.drawingUrl || data.drawing_url || null,
  };
  const [op] = await db('bom.operations').insert(row).returning('*');
  return op;
}

export async function updateOperation(id, data) {
  const row = {};
  // Map of snake_case DB fields that can come directly from frontend
  const snakeFields = ['operation_name','operation_type','machine_type','machine_id',
    'cycle_time_seconds','setup_time_minutes','description','sequence',
    'cnc_program','raw_material_spec','tools_config','machine_parameters',
    'consumables','attention_points','min_batch_before_next','nr_cavities',
    'pieces_per_hour','transfer_type','is_active',
    'transport_time_minutes','deposit_location','reject_action','time_unit',
    'input_material_id','drawing_url'];
  const jsonFields = ['tools_config','machine_parameters','consumables','attention_points'];

  for (const f of snakeFields) {
    if (data[f] !== undefined) {
      row[f] = jsonFields.includes(f) ? JSON.stringify(data[f]) : data[f];
    }
  }

  // Also handle camelCase from frontend
  const camelMap = {
    operationName: 'operation_name', operationType: 'operation_type', machineType: 'machine_type',
    machineId: 'machine_id', cycleTimeSeconds: 'cycle_time_seconds', nrCavities: 'nr_cavities',
    setupTimeMinutes: 'setup_time_minutes', isActive: 'is_active',
    cncProgram: 'cnc_program', rawMaterialSpec: 'raw_material_spec',
    toolsConfig: 'tools_config', machineParameters: 'machine_parameters',
    attentionPoints: 'attention_points', minBatchBeforeNext: 'min_batch_before_next',
    piecesPerHour: 'pieces_per_hour', transferType: 'transfer_type',
    transportTimeMinutes: 'transport_time_minutes', depositLocation: 'deposit_location',
    rejectAction: 'reject_action', timeUnit: 'time_unit',
    inputMaterialId: 'input_material_id', drawingUrl: 'drawing_url',
  };
  for (const [camel, snake] of Object.entries(camelMap)) {
    if (data[camel] !== undefined) {
      row[snake] = jsonFields.includes(snake) ? JSON.stringify(data[camel]) : data[camel];
    }
  }

  // Recalculate pieces_per_hour
  const ct = row.cycle_time_seconds ?? data.cycleTimeSeconds ?? data.cycle_time_seconds;
  const nc = row.nr_cavities ?? data.nrCavities ?? data.nr_cavities ?? 1;
  if (ct && ct > 0) row.pieces_per_hour = (3600 / ct) * (nc || 1);

  const [op] = await db('bom.operations').where({ id }).update(row).returning('*');
  return op;
}

export async function deleteOperation(id) {
  return db('bom.operations').where({ id }).delete();
}

// ─── Materials ───────────────────────────────────────────────────────────────

export async function listMaterials(productId) {
  return db('bom.materials').where({ product_id: productId });
}

export async function createMaterial(productId, data) {
  const [mat] = await db('bom.materials').insert({
    product_id: productId,
    material_name: data.materialName,
    material_code: data.materialCode,
    material_type: data.materialType,
    qty_per_piece: data.qtyPerPiece,
    unit: data.unit || 'kg',
    waste_factor: data.wasteFactor || 1.0,
    supplier: data.supplier,
    notes: data.notes,
  }).returning('*');
  return mat;
}

export async function updateMaterial(id, data) {
  const row = {};
  if (data.materialName !== undefined) row.material_name = data.materialName;
  if (data.materialCode !== undefined) row.material_code = data.materialCode;
  if (data.materialType !== undefined) row.material_type = data.materialType;
  if (data.qtyPerPiece !== undefined) row.qty_per_piece = data.qtyPerPiece;
  if (data.unit !== undefined) row.unit = data.unit;
  if (data.wasteFactor !== undefined) row.waste_factor = data.wasteFactor;
  if (data.supplier !== undefined) row.supplier = data.supplier;
  if (data.notes !== undefined) row.notes = data.notes;
  const [mat] = await db('bom.materials').where({ id }).update(row).returning('*');
  return mat;
}

export async function deleteMaterial(id) {
  return db('bom.materials').where({ id }).delete();
}

// ─── Dependencies ─────────────────────────────────────────────────────────────

export async function getProductDependencies(productId) {
  return getDependencyTree(productId);
}

export async function addDependency(operationId, data) {
  const [r] = await db('bom.operation_dependencies').insert({ operation_id: operationId, ...data }).returning('*');
  return r;
}

export async function removeDependency(id) {
  return db('bom.operation_dependencies').where('id', id).delete();
}

export async function getBackwardSchedule(productId, deadline, quantity) {
  return calculateBackwardSchedule(productId, deadline, parseInt(quantity));
}

// ─── Assembly Components ─────────────────────────────────────────────────────

export async function listComponents(productId) {
  return db('bom.assembly_components').where({ parent_product_id: productId });
}

export async function createComponent(productId, data) {
  const [comp] = await db('bom.assembly_components').insert({
    parent_product_id: productId,
    component_product_id: data.componentProductId,
    component_reference: data.componentReference,
    component_name: data.componentName,
    qty_per_parent: data.qtyPerParent || 1,
    notes: data.notes,
  }).returning('*');
  return comp;
}

export async function updateComponent(id, data) {
  const row = {};
  const fieldMap = {
    componentName: 'component_name', componentReference: 'component_reference',
    qtyPerParent: 'qty_per_parent', positionCode: 'position_code',
    materialCode: 'material_code', materialGrade: 'material_grade',
    rawDimensions: 'raw_dimensions', componentType: 'component_type',
    supplierCode: 'supplier_code', standardReference: 'standard_reference',
    inventoryItemId: 'inventory_item_id', notes: 'notes',
    component_name: 'component_name', component_reference: 'component_reference',
    qty_per_parent: 'qty_per_parent', position_code: 'position_code',
    material_code: 'material_code', material_grade: 'material_grade',
    raw_dimensions: 'raw_dimensions', component_type: 'component_type',
    supplier_code: 'supplier_code', standard_reference: 'standard_reference',
    inventory_item_id: 'inventory_item_id',
  };
  for (const [key, col] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) row[col] = data[key];
  }
  const [comp] = await db('bom.assembly_components').where({ id }).update(row).returning('*');
  return comp;
}

// ─── Product Tree (recursive BOM) ────────────────────────────────────────────

export async function getProductTree(productId, depth = 0, maxDepth = 10) {
  if (depth > maxDepth) return null;
  const product = await db('bom.products').where('id', productId).first();
  if (!product) return null;

  const operations = await db('bom.operations')
    .leftJoin('machines.machines as m', 'bom.operations.machine_id', 'm.id')
    .where('bom.operations.product_id', productId)
    .orderBy('sequence')
    .select('bom.operations.*', 'm.code as machine_code', 'm.name as machine_name');

  const components = await db('bom.assembly_components')
    .where('parent_product_id', productId);

  const materials = await db('bom.materials')
    .where('product_id', productId);

  // Recursively get child product trees
  const children = [];
  for (const comp of components) {
    if (comp.component_product_id) {
      const childTree = await getProductTree(comp.component_product_id, depth + 1, maxDepth);
      children.push({
        ...comp,
        childProduct: childTree,
      });
    } else {
      children.push(comp);
    }
  }

  return {
    ...product,
    operations,
    materials,
    children,
    depth,
  };
}

// ─── Cost Rates ───────────────────────────────────────────────────────────────

export async function listCostRates() {
  return db('bom.cost_rates').orderBy('rate_type');
}

export async function createCostRate(data) {
  const [rate] = await db('bom.cost_rates').insert({
    rate_type: data.rateType,
    reference_id: data.referenceId,
    reference_name: data.referenceName,
    rate_eur_per_hour: data.rateEurPerHour,
    rate_eur_per_unit: data.rateEurPerUnit,
    valid_from: data.validFrom || new Date(),
    valid_to: data.validTo,
    notes: data.notes,
  }).returning('*');
  return rate;
}

// ─── MBOM for Work Order ─────────────────────────────────────────────────────

export async function getMBOMForOrder(orderId) {
  const order = await db('production.work_orders').where('id', orderId).first();
  if (!order) return null;

  // Find the product from BOM by matching product_reference or product_name
  let product = null;
  if (order.product_id) {
    product = await db('bom.products').where('id', order.product_id).first();
  }
  if (!product && (order.product_reference || order.product_name)) {
    product = await db('bom.products')
      .where(q => {
        if (order.product_reference) q.where('reference', order.product_reference);
        else if (order.product_name) q.orWhere('name', 'ilike', `%${escapeLike(order.product_name)}%`);
      })
      .first();
  }

  if (!product) {
    // Check if any other product with the same reference has operations (for MBOM reuse suggestion)
    let reusableProduct = null;
    const ref = order.product_reference || order.product_name;
    if (ref) {
      const candidates = await db('bom.products')
        .where('reference', ref)
        .orWhere('name', 'ilike', `%${escapeLike(ref)}%`);
      for (const cand of candidates) {
        const ops = await db('bom.operations').where('product_id', cand.id).limit(1);
        if (ops.length > 0) { reusableProduct = cand; break; }
      }
    }
    return { order, product: null, operations: [], components: [], reusableProduct: reusableProduct || null };
  }

  // Check if this product already has operations defined (reuse detection)
  const existingOps = await db('bom.operations').where('product_id', product.id);
  let isReused = false;
  let reusableProduct = null;

  if (existingOps.length === 0) {
    // No operations for this product — look for another product with same reference that has operations
    const candidates = await db('bom.products')
      .where('reference', product.reference)
      .whereNot('id', product.id);
    for (const cand of candidates) {
      const ops = await db('bom.operations').where('product_id', cand.id).limit(1);
      if (ops.length > 0) { reusableProduct = cand; break; }
    }
  } else {
    // Product has operations — check if they were copied (flag for UI)
    isReused = existingOps.length > 0;
  }

  // Get operations with machine names
  const operations = await db('bom.operations as o')
    .leftJoin('machines.machines as m', 'o.machine_id', 'm.id')
    .where('o.product_id', product.id)
    .orderBy('o.sequence')
    .select('o.*', 'm.code as machine_code', 'm.name as machine_name');

  // Get alternatives for each operation
  for (const op of operations) {
    op.alternatives = await db('bom.operation_alternatives as oa')
      .leftJoin('machines.machines as am', 'oa.machine_id', 'am.id')
      .where('oa.operation_id', op.id)
      .select('oa.*', 'am.code as machine_code', 'am.name as machine_name');
  }

  // Get assembly components with extended fields
  const components = await db('bom.assembly_components')
    .where('parent_product_id', product.id)
    .select('*');

  // For each fabricated component, get its sub-operations
  for (const comp of components) {
    if (comp.component_product_id) {
      comp.operations = await db('bom.operations as o')
        .leftJoin('machines.machines as m', 'o.machine_id', 'm.id')
        .where('o.product_id', comp.component_product_id)
        .orderBy('o.sequence')
        .select('o.*', 'm.code as machine_code', 'm.name as machine_name');
    } else {
      comp.operations = [];
    }
  }

  // Get machine load data (count of active work order allocations per machine)
  let machineLoad = [];
  try {
    machineLoad = await db('bom.operations as o')
      .join('production.work_orders as wo', function() {
        this.on('wo.product_id', '=', 'o.product_id')
          .orOn('wo.product_reference', '=', db.raw('(SELECT reference FROM bom.products WHERE id = o.product_id)'));
      })
      .whereNotIn('wo.status_code', ['completed', 'cancelled'])
      .whereNotNull('o.machine_id')
      .groupBy('o.machine_id')
      .select('o.machine_id')
      .count('* as allocation_count')
      .sum('o.cycle_time_seconds as total_cycle_seconds');
  } catch (_e) {
    // If query fails (e.g. missing columns), return empty
    machineLoad = [];
  }

  return { order, product, operations, components, machineLoad, isReused, reusableProduct };
}

// ─── Operation Alternatives ──────────────────────────────────────────────────

export async function addAlternative(operationId, data) {
  const [alt] = await db('bom.operation_alternatives').insert({
    operation_id: operationId,
    machine_id: data.machineId || data.machine_id,
    is_preferred: data.isPreferred || data.is_preferred || false,
    cycle_time_seconds_override: data.cycleTimeSecondsOverride || data.cycle_time_seconds_override || null,
    setup_time_minutes_override: data.setupTimeMinutesOverride || data.setup_time_minutes_override || null,
    notes: data.notes || null,
  }).returning('*');
  return alt;
}

export async function removeAlternative(id) {
  return db('bom.operation_alternatives').where({ id }).delete();
}

// ─── Validate MBOM ──────────────────────────────────────────────────────────

export async function validateMBOM(productId) {
  const [product] = await db('bom.products').where({ id: productId })
    .update({ approval_status: 'active', approved_at: new Date() })
    .returning('*');
  return product;
}

// ─── Cost Calculator ──────────────────────────────────────────────────────────

export async function calculateCost(productId) {
  const product = await db('bom.products').where({ id: productId }).first();
  if (!product) return null;

  const [operations, materials, overheadRate] = await Promise.all([
    db('bom.operations').where({ product_id: productId, is_active: true }),
    db('bom.materials').where({ product_id: productId }),
    db('bom.cost_rates').where({ rate_type: 'overhead' }).orderBy('valid_from', 'desc').first(),
  ]);

  // Get material cost rates
  const materialRates = await db('bom.cost_rates').where({ rate_type: 'material' });
  const rateMap = {};
  for (const r of materialRates) {
    if (r.reference_name) rateMap[r.reference_name.toLowerCase()] = r;
  }

  const materialCosts = materials.map((m) => {
    const rate = rateMap[m.material_name?.toLowerCase()] || rateMap[m.material_code?.toLowerCase()];
    const costPerUnit = rate?.rate_eur_per_unit || 0;
    const cost = m.qty_per_piece * (m.waste_factor || 1) * costPerUnit;
    return { materialName: m.material_name, materialCode: m.material_code, qtyPerPiece: m.qty_per_piece, wasteFactor: m.waste_factor, costPerUnit, cost };
  });

  // Get machine hourly rates
  const machineRates = await db('bom.cost_rates').where({ rate_type: 'machine_hourly' });
  const machineRateMap = {};
  for (const r of machineRates) {
    if (r.reference_id) machineRateMap[r.reference_id] = r;
    if (r.reference_name) machineRateMap[r.reference_name.toLowerCase()] = r;
  }

  const operationCosts = operations.map((op) => {
    const rate = machineRateMap[op.machine_id] || machineRateMap[op.machine_type?.toLowerCase()];
    const ratePerHour = rate?.rate_eur_per_hour || 0;
    const pph = op.pieces_per_hour || 1;
    const cost = (1 / pph) * ratePerHour;
    return { operationName: op.operation_name, sequence: op.sequence, piecesPerHour: pph, ratePerHour, cost };
  });

  const totalMaterial = materialCosts.reduce((s, m) => s + (m.cost || 0), 0);
  const totalOperation = operationCosts.reduce((s, o) => s + (o.cost || 0), 0);
  const overheadRateVal = overheadRate?.rate_eur_per_hour || 0;
  const overhead = (totalMaterial + totalOperation) * (overheadRateVal / 100);
  const totalCostPerPiece = totalMaterial + totalOperation + overhead;

  return {
    product: { id: product.id, reference: product.reference, name: product.name },
    materialCosts,
    operationCosts,
    summary: { totalMaterial, totalOperation, overhead, totalCostPerPiece },
  };
}

// ─── Copy MBOM from one product to another ──────────────────────────────────

export async function copyMBOMFromProduct(sourceProductId, targetProductId) {
  // Copy all operations from source to target
  const ops = await db('bom.operations').where('product_id', sourceProductId);
  for (const op of ops) {
    const { id, product_id, created_at, ...data } = op;
    await db('bom.operations').insert({ ...data, product_id: targetProductId });
  }
  // Copy materials
  const mats = await db('bom.materials').where('product_id', sourceProductId);
  for (const mat of mats) {
    const { id, product_id, created_at, ...data } = mat;
    await db('bom.materials').insert({ ...data, product_id: targetProductId });
  }
  return { copiedOperations: ops.length, copiedMaterials: mats.length };
}
