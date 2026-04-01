import db from '../config/db.js';
import { calculateRequirements } from './mrp.service.js';

/**
 * Generate aggregated POs per supplier from MRP results.
 * Groups all deficit materials by primary supplier.
 */
export async function generateAggregatedPOs(workOrderIds) {
  // Calculate requirements
  const requirements = await calculateRequirements(workOrderIds);

  // Filter only deficit items
  const deficits = requirements.filter(r => r.deficit > 0 && r.suggestedPO);

  // Group by supplier
  const bySupplier = {};
  for (const req of deficits) {
    const sid = req.suggestedPO.supplierId;
    if (!sid) continue;
    if (!bySupplier[sid]) {
      bySupplier[sid] = {
        supplierId: sid,
        supplierName: req.suggestedPO.supplierName,
        lines: [],
        totalEstimatedCost: 0,
        maxLeadTimeDays: 0,
      };
    }
    const lineCost = req.deficit * (Number(req.suggestedPO.unitPrice) || 0);
    bySupplier[sid].lines.push({
      materialName: req.materialName,
      materialCode: req.materialCode,
      itemId: req.itemId,
      quantity: req.deficit,
      unit: req.unit,
      unitPrice: req.suggestedPO.unitPrice,
      totalPrice: Math.round(lineCost * 100) / 100,
      neededForOrders: req.orders?.map(o => o.orderNumber).join(', '),
    });
    bySupplier[sid].totalEstimatedCost += lineCost;
    bySupplier[sid].maxLeadTimeDays = Math.max(bySupplier[sid].maxLeadTimeDays, req.suggestedPO.leadTimeDays || 0);
  }

  // Round totals
  for (const group of Object.values(bySupplier)) {
    group.totalEstimatedCost = Math.round(group.totalEstimatedCost * 100) / 100;
  }

  return {
    suppliers: Object.values(bySupplier).sort((a, b) => b.totalEstimatedCost - a.totalEstimatedCost),
    totalDeficitItems: deficits.length,
    totalEstimatedCost: Math.round(Object.values(bySupplier).reduce((s, g) => s + g.totalEstimatedCost, 0) * 100) / 100,
  };
}

/**
 * Create actual POs from aggregated data.
 */
export async function createAggregatedPOs(supplierGroups, userId) {
  const createdPOs = [];

  for (const group of supplierGroups) {
    // Create PO
    const result = await db.raw("SELECT nextval('purchasing.po_seq')").catch(() => ({ rows: [{ nextval: Date.now() }] }));
    const nextval = result.rows?.[0]?.nextval || Date.now();
    const poNumber = `PO-${new Date().getFullYear()}-${String(nextval).padStart(5, '0')}`;

    const [po] = await db('purchasing.purchase_orders').insert({
      po_number: poNumber,
      supplier_id: group.supplierId,
      status: 'draft',
      total_amount: group.totalEstimatedCost,
      currency: 'RON',
      notes: `Comanda agregata din MRP — ${group.lines.length} articole necesare pentru: ${group.lines.map(l => l.neededForOrders).join('; ')}`,
      created_by: userId,
    }).returning('*');

    // Add lines
    for (const line of group.lines) {
      await db('purchasing.purchase_order_lines').insert({
        po_id: po.id,
        item_id: line.itemId || null,
        description: `${line.materialName} (${line.materialCode})`,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unitPrice || 0,
      });
    }

    createdPOs.push({ poNumber, supplierId: group.supplierId, supplierName: group.supplierName, lines: group.lines.length, total: group.totalEstimatedCost });
  }

  return createdPOs;
}
