import db from '../config/db.js';

export async function listLocations(tenantId, type) {
  let q = db('inventory.locations').where('is_active', true);
  if (tenantId) q = q.where('tenant_id', tenantId);
  if (type) q = q.where('location_type', type);
  return q.orderBy('location_type', 'asc').orderBy('code', 'asc');
}

export async function createLocation(data) {
  const [loc] = await db('inventory.locations').insert({
    code: data.code,
    name: data.name,
    location_type: data.locationType,
    zone: data.zone,
    capacity: data.capacity,
    capacity_unit: data.capacityUnit,
    org_unit_id: data.orgUnitId,
    tenant_id: data.tenantId,
  }).returning('*');
  return loc;
}

export async function updateLocation(id, data) {
  const row = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.zone !== undefined) row.zone = data.zone;
  if (data.capacity !== undefined) row.capacity = data.capacity;
  if (data.capacityUnit !== undefined) row.capacity_unit = data.capacityUnit;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  const [loc] = await db('inventory.locations').where('id', id).update(row).returning('*');
  return loc;
}

export async function deleteLocation(id) {
  return db('inventory.locations').where('id', id).update({ is_active: false });
}
