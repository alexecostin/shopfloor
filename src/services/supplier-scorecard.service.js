import db from '../config/db.js';

export async function calculateQualityScore(supplierId, dateFrom, dateTo) {
  // Total deliveries from this supplier
  const [{ total }] = await db('inventory.purchase_history')
    .where('supplier_id', supplierId)
    .where('created_at', '>=', dateFrom).where('created_at', '<=', dateTo)
    .count('* as total');

  // NCRs related to supplier
  const [{ problems }] = await db('quality.ncr')
    .where('ncr_type', 'supplier')
    .where('created_at', '>=', dateFrom).where('created_at', '<=', dateTo)
    .count('* as problems').catch(() => [{ problems: 0 }]);

  const t = Number(total) || 1;
  const p = Number(problems) || 0;
  return { score: Math.round(((t - p) / t) * 100), deliveries: t, problems: p };
}

export async function calculateDeliveryScore(supplierId, dateFrom, dateTo) {
  // POs received for this supplier
  const pos = await db('purchasing.purchase_orders')
    .where('supplier_id', supplierId)
    .whereIn('status', ['received', 'partially_received'])
    .where('created_at', '>=', dateFrom).where('created_at', '<=', dateTo)
    .select('id', 'confirmed_delivery_date').catch(() => []);

  if (pos.length === 0) return { score: 100, total: 0, onTime: 0 };

  // Check receipts vs confirmed delivery date
  let onTime = 0;
  for (const po of pos) {
    if (!po.confirmed_delivery_date) { onTime++; continue; }
    const receipts = await db('purchasing.po_receipts').where('po_id', po.id).orderBy('received_at').first().catch(() => null);
    if (receipts && new Date(receipts.received_at) <= new Date(po.confirmed_delivery_date)) onTime++;
  }

  return { score: Math.round((onTime / pos.length) * 100), total: pos.length, onTime };
}

export async function calculatePriceScore(supplierId, dateFrom, dateTo) {
  // Get supplier's items with prices
  const items = await db('inventory.item_suppliers')
    .where('supplier_id', supplierId)
    .select('item_id', 'unit_price').catch(() => []);

  if (items.length === 0) return { score: 100, items: 0 };

  let totalScore = 0;
  for (const item of items) {
    // Average price from all suppliers for same item
    const [{ avg: avgPrice }] = await db('inventory.item_suppliers')
      .where('item_id', item.item_id)
      .avg('unit_price as avg').catch(() => [{ avg: item.unit_price }]);

    const avg = Number(avgPrice) || Number(item.unit_price);
    const price = Number(item.unit_price);
    // Score: 100 if at or below average, decreases as price increases
    const ratio = avg > 0 ? Math.min(100, Math.round((avg / price) * 100)) : 100;
    totalScore += ratio;
  }

  return { score: Math.round(totalScore / items.length), items: items.length };
}

export async function getOverallScore(supplierId, dateFrom, dateTo, weights = { quality: 40, delivery: 30, price: 20, reactivity: 10 }) {
  const quality = await calculateQualityScore(supplierId, dateFrom, dateTo);
  const delivery = await calculateDeliveryScore(supplierId, dateFrom, dateTo);
  const price = await calculatePriceScore(supplierId, dateFrom, dateTo);

  // Reactivity is manual (stored in company settings or a separate field)
  const company = await db('companies.companies').where('id', supplierId).first();
  const reactivity = company?.settings?.reactivity_score || 75;

  const overall = Math.round(
    (quality.score * weights.quality + delivery.score * weights.delivery +
     price.score * weights.price + reactivity * weights.reactivity) / 100
  );

  return { supplierId, overall, quality, delivery, price, reactivity: { score: reactivity }, weights };
}

export async function getRanking(tenantId, dateFrom, dateTo) {
  const suppliers = await db('companies.companies')
    .modify(q => { if (tenantId) q.where('tenant_id', tenantId); })
    .whereRaw("company_types::text LIKE '%furnizor%'")
    .select('id', 'name').catch(() => []);

  const results = [];
  for (const s of suppliers) {
    const scorecard = await getOverallScore(s.id, dateFrom, dateTo);
    results.push({ ...s, ...scorecard });
  }

  return results.sort((a, b) => b.overall - a.overall);
}

export async function setReactivity(supplierId, score, notes) {
  const company = await db('companies.companies').where('id', supplierId).first();
  const settings = company?.settings || {};
  settings.reactivity_score = score;
  settings.reactivity_notes = notes;
  await db('companies.companies').where('id', supplierId).update({ settings: JSON.stringify(settings) });
  return { score, notes };
}
