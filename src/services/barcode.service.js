import db from '../config/db.js';
import crypto from 'crypto';

function generateBarcodeValue(entityType, entityId) {
  const hash = crypto.createHash('sha256').update(`${entityType}:${entityId}:${Date.now()}`).digest('hex').substring(0, 12).toUpperCase();
  return `SF-${entityType.substring(0, 3).toUpperCase()}-${hash}`;
}

export async function generate(entityType, entityId, label, tenantId, barcodeType = 'qr') {
  // Check if already exists
  const existing = await db('inventory.barcodes').where({ entity_type: entityType, entity_id: entityId }).first();
  if (existing) return existing;

  const barcodeValue = generateBarcodeValue(entityType, entityId);
  const [barcode] = await db('inventory.barcodes').insert({
    barcode_value: barcodeValue, barcode_type: barcodeType,
    entity_type: entityType, entity_id: entityId,
    label: label || null, tenant_id: tenantId || null,
  }).returning('*');
  return barcode;
}

export async function generateBatch(entityType, items, tenantId) {
  const results = [];
  for (const { entityId, label } of items) {
    const barcode = await generate(entityType, entityId, label, tenantId);
    results.push(barcode);
  }
  return results;
}

export async function lookup(barcodeValue) {
  const barcode = await db('inventory.barcodes').where({ barcode_value: barcodeValue, is_active: true }).first();
  if (!barcode) return null;

  // Fetch the entity details
  let entity = null;
  try {
    switch (barcode.entity_type) {
      case 'machine': entity = await db('machines.machines').where('id', barcode.entity_id).first(); break;
      case 'tool': entity = await db('machines.tools').where('id', barcode.entity_id).first(); break;
      case 'inventory_item': entity = await db('inventory.items').where('id', barcode.entity_id).first(); break;
      case 'product': entity = await db('bom.products').where('id', barcode.entity_id).first(); break;
      case 'work_order': entity = await db('production.work_orders').where('id', barcode.entity_id).first(); break;
    }
  } catch (e) { /* entity may not exist */ }

  return { ...barcode, entity };
}

export async function associate(barcodeValue, entityType, entityId, tenantId) {
  const existing = await db('inventory.barcodes').where({ barcode_value: barcodeValue }).first();
  if (existing) {
    await db('inventory.barcodes').where('id', existing.id).update({ entity_type: entityType, entity_id: entityId });
    return db('inventory.barcodes').where('id', existing.id).first();
  }
  const [barcode] = await db('inventory.barcodes').insert({
    barcode_value: barcodeValue, barcode_type: 'external',
    entity_type: entityType, entity_id: entityId, tenant_id: tenantId,
  }).returning('*');
  return barcode;
}

export async function listBarcodes({ entityType, tenantId, page = 1, limit = 50 } = {}) {
  let q = db('inventory.barcodes');
  if (entityType) q = q.where('entity_type', entityType);
  if (tenantId) q = q.where('tenant_id', tenantId);
  const [{ count }] = await q.clone().count('* as count');
  const data = await q.clone().orderBy('created_at', 'desc').limit(limit).offset((page - 1) * limit);
  return { data, total: Number(count) };
}
