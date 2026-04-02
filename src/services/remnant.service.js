import db from '../config/db.js';

export async function listRemnants(tenantId, filters = {}) {
  let q = db('inventory.remnants').where('status', 'available');
  if (tenantId) q = q.where('tenant_id', tenantId);
  if (filters.materialCode) q = q.where('material_code', filters.materialCode);
  if (filters.materialGrade) q = q.where('material_grade', filters.materialGrade);
  if (filters.shape) q = q.where('shape', filters.shape);
  if (filters.minDiameter) q = q.where('dimension_diameter', '>=', filters.minDiameter);
  if (filters.minLength) q = q.where('dimension_length', '>=', filters.minLength);
  return q.orderBy('created_at', 'desc');
}

export async function createRemnant(data) {
  const [remnant] = await db('inventory.remnants').insert({
    source_item_id: data.sourceItemId,
    material_code: data.materialCode,
    material_name: data.materialName,
    material_grade: data.materialGrade,
    shape: data.shape,
    dimension_length: data.length,
    dimension_width: data.width,
    dimension_diameter: data.diameter,
    dimension_thickness: data.thickness,
    weight_kg: data.weightKg,
    quantity: data.quantity || 1,
    source_work_order_id: data.workOrderId,
    source_operation_id: data.operationId,
    location_id: data.locationId,
    tenant_id: data.tenantId,
  }).returning('*');
  return remnant;
}

/**
 * Find remnants that can be used for a given material requirement.
 * Matches: material_grade + shape + dimensions >= required.
 */
export async function findMatchingRemnants(materialGrade, shape, requiredDiameter, requiredLength) {
  let q = db('inventory.remnants').where({ status: 'available', material_grade: materialGrade, shape: shape || 'bar' });
  if (requiredDiameter) q = q.where('dimension_diameter', '>=', requiredDiameter);
  if (requiredLength) q = q.where('dimension_length', '>=', requiredLength);
  const matches = await q.orderBy('dimension_length', 'asc'); // smallest matching first (minimize waste)
  return matches.map(r => ({
    ...r,
    savings: 'Foloseste rest in loc de material nou',
    excessLength: requiredLength ? (Number(r.dimension_length) - requiredLength) : null,
  }));
}

export async function useRemnant(id) {
  return db('inventory.remnants').where('id', id).update({ status: 'used' });
}

export async function scrapRemnant(id) {
  return db('inventory.remnants').where('id', id).update({ status: 'scrapped' });
}
