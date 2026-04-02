import db from '../config/db.js';
import { escapeLike } from '../utils/sanitize.js';

/**
 * Calculate material requirements for one or more work orders.
 * Returns: per material -- needed, available, deficit, suggested PO.
 */
export async function calculateRequirements(workOrderIds) {
  const requirements = {};

  for (const woId of workOrderIds) {
    const wo = await db('production.work_orders').where('id', woId).first();
    if (!wo) continue;

    // Find BOM product
    let product = null;
    if (wo.product_id) {
      product = await db('bom.products').where('id', wo.product_id).first();
    }
    if (!product && (wo.product_reference || wo.product_name)) {
      product = await db('bom.products')
        .where(q => {
          if (wo.product_reference) q.where('reference', wo.product_reference);
          else if (wo.product_name) q.where('name', 'ilike', `%${escapeLike(wo.product_name)}%`);
        })
        .first();
    }
    if (!product) continue;

    // Get materials
    const materials = await db('bom.materials').where('product_id', product.id);

    for (const mat of materials) {
      const key = mat.material_code || mat.material_name;
      if (!requirements[key]) {
        requirements[key] = {
          materialName: mat.material_name,
          materialCode: mat.material_code,
          unit: mat.unit,
          totalNeeded: 0,
          orders: [],
        };
      }
      const qtyNeeded = Math.ceil((mat.qty_per_piece || 1) * (wo.quantity || 1) * (mat.waste_factor || 1));
      requirements[key].totalNeeded += qtyNeeded;
      requirements[key].orders.push({
        workOrderId: woId,
        orderNumber: wo.work_order_number,
        productName: wo.product_name,
        quantity: wo.quantity,
        qtyNeeded,
      });
    }
  }

  // Check stock for each material
  const results = [];
  for (const [key, req] of Object.entries(requirements)) {
    let item = null;
    try {
      item = await db('inventory.items')
        .where('code', req.materialCode)
        .orWhere('name', 'ilike', `%${escapeLike(req.materialName)}%`)
        .first();
    } catch (_e) {
      // inventory schema may not exist
    }

    let stockLevel = null;
    try {
      stockLevel = item ? await db('inventory.stock_levels').where('item_id', item.id).first() : null;
    } catch (_e) {
      // table may not exist
    }

    const available = Number(stockLevel?.current_qty) || 0;
    const deficit = Math.max(0, req.totalNeeded - available);

    // Find primary supplier
    let supplier = null;
    if (item) {
      supplier = await db('inventory.item_suppliers')
        .leftJoin('companies.companies as c', 'inventory.item_suppliers.supplier_id', 'c.id')
        .where('inventory.item_suppliers.item_id', item.id)
        .orderBy('inventory.item_suppliers.priority')
        .select('c.id as supplier_id', 'c.name as supplier_name', 'inventory.item_suppliers.unit_price', 'inventory.item_suppliers.lead_time_days')
        .first()
        .catch(() => null);
    }

    results.push({
      ...req,
      itemId: item?.id || null,
      available,
      deficit,
      status: deficit === 0 ? 'ok' : available > 0 ? 'partial' : 'missing',
      suggestedPO: deficit > 0 ? {
        supplierId: supplier?.supplier_id,
        supplierName: supplier?.supplier_name,
        quantity: deficit,
        unitPrice: supplier?.unit_price,
        leadTimeDays: supplier?.lead_time_days,
        estimatedCost: deficit * (Number(supplier?.unit_price) || 0),
      } : null,
    });
  }

  return results.sort((a, b) => {
    const statusOrder = { missing: 0, partial: 1, ok: 2 };
    return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
  });
}

/**
 * Generate POs from MRP results.
 */
export async function generatePOsFromMRP(requirements, userId) {
  // Group by supplier
  const bySupplier = {};
  for (const req of requirements) {
    if (!req.suggestedPO?.supplierId) continue;
    const sid = req.suggestedPO.supplierId;
    if (!bySupplier[sid]) bySupplier[sid] = { supplierId: sid, supplierName: req.suggestedPO.supplierName, lines: [] };
    bySupplier[sid].lines.push({
      itemId: req.itemId,
      description: req.materialName,
      quantity: req.deficit,
      unit: req.unit,
      unitPrice: req.suggestedPO.unitPrice,
    });
  }

  // Create POs (use purchasing service if available, or direct insert)
  const pos = [];
  for (const group of Object.values(bySupplier)) {
    // Simple: just return the data for now, actual PO creation via purchasing module
    pos.push(group);
  }
  return pos;
}
