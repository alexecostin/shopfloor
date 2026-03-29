import db from '../../config/db.js';

// ─── Products ────────────────────────────────────────────────────────────────

export async function listProducts({ page = 1, limit = 50, type, client, active, search } = {}) {
  const offset = (page - 1) * limit;
  let q = db('bom.products').orderBy('reference');
  if (type) q = q.where('product_type', type);
  if (client) q = q.where('client_name', 'ilike', `%${client}%`);
  if (active !== undefined) q = q.where('is_active', active === 'true' || active === true);
  if (search) q = q.where((b) => b.where('reference', 'ilike', `%${search}%`).orWhere('name', 'ilike', `%${search}%`));
  const [{ count }] = await q.clone().count('* as count');
  const data = await q.limit(limit).offset(offset);
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

export async function updateProduct(id, data) {
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
  const [product] = await db('bom.products').where({ id }).update(row).returning('*');
  return product;
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function listOperations(productId) {
  return db('bom.operations').where({ product_id: productId }).orderBy('sequence');
}

export async function createOperation(productId, data) {
  let piecesPerHour = data.piecesPerHour || null;
  if (data.cycleTimeSeconds && data.cycleTimeSeconds > 0) {
    piecesPerHour = (3600 / data.cycleTimeSeconds) * (data.nrCavities || 1);
  }
  const row = {
    product_id: productId,
    sequence: data.sequence,
    operation_name: data.operationName,
    operation_type: data.operationType,
    machine_type: data.machineType,
    machine_id: data.machineId,
    cycle_time_seconds: data.cycleTimeSeconds,
    nr_cavities: data.nrCavities || 1,
    pieces_per_hour: piecesPerHour,
    setup_time_minutes: data.setupTimeMinutes || 0,
    description: data.description,
    is_active: data.isActive !== false,
  };
  const [op] = await db('bom.operations').insert(row).returning('*');
  return op;
}

export async function updateOperation(id, data) {
  const row = {};
  const fields = ['operationName', 'operationType', 'machineType', 'machineId',
    'cycleTimeSeconds', 'nrCavities', 'setupTimeMinutes', 'description', 'isActive', 'sequence'];
  const dbMap = {
    operationName: 'operation_name', operationType: 'operation_type', machineType: 'machine_type',
    machineId: 'machine_id', cycleTimeSeconds: 'cycle_time_seconds', nrCavities: 'nr_cavities',
    setupTimeMinutes: 'setup_time_minutes', isActive: 'is_active', sequence: 'sequence',
  };
  for (const f of fields) {
    if (data[f] !== undefined) row[dbMap[f] || f] = data[f];
  }
  if ((data.cycleTimeSeconds || row.cycle_time_seconds) && (data.nrCavities || row.nr_cavities)) {
    const ct = data.cycleTimeSeconds || row.cycle_time_seconds;
    const nc = data.nrCavities || row.nr_cavities || 1;
    if (ct > 0) row.pieces_per_hour = (3600 / ct) * nc;
  }
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
