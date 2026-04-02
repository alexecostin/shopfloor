import db from '../config/db.js';
import { escapeLike } from '../utils/sanitize.js';
import { getTenantConfig } from './app-config.service.js';

// These are resolved dynamically from tenant config; see _getCostDefaults()
let _costConfig = null;
async function _getCostDefaults() {
  if (!_costConfig) _costConfig = await getTenantConfig(null).catch(() => ({}));
  return _costConfig;
}

/**
 * Calculate full order cost: planned vs actual vs estimated final.
 */
export async function calculateOrderCost(orderId) {
  const order = await db('production.orders').where('id', orderId).first();
  if (!order) return null;

  const costDefaults = await _getCostDefaults();
  const MACHINE_HOURLY_RATE_DEFAULT = costDefaults.defaultMachineHourlyRate || 25;
  const LABOR_HOURLY_RATE_DEFAULT = costDefaults.defaultLaborHourlyRate || 15;

  // ── PLANNED COST (from BOM) ──────────────────────────────────────────────
  let plannedMaterialCost = 0;  // may be reduced by scrap recovery below
  let plannedLaborCost = 0;
  let plannedMachineCost = 0;

  const bomProduct = await db('bom.products').where('reference', order.product_code).first();
  if (bomProduct) {
    // Materials cost
    const materials = await db('bom.materials')
      .join('inventory.items as ii', 'bom.materials.item_id', 'ii.id')
      .where('bom.materials.product_id', bomProduct.id)
      .select('bom.materials.quantity_per_unit', 'ii.unit_cost');
    for (const m of materials) {
      plannedMaterialCost += Number(m.quantity_per_unit || 0) * Number(m.unit_cost || 0) * order.target_quantity;
    }

    // Operations cost
    const operations = await db('bom.operations').where('product_id', bomProduct.id);
    for (const op of operations) {
      const pph = op.pieces_per_hour || 1;
      const hours = order.target_quantity / pph + (op.setup_time_minutes || 0) / 60;

      // Machine rate from capabilities or default
      const cap = op.machine_id ? await db('machines.machine_capabilities')
        .where({ machine_id: op.machine_id })
        .orderBy('hourly_rate_eur', 'desc').first() : null;
      const machineRate = cap?.hourly_rate_eur ? Number(cap.hourly_rate_eur) : MACHINE_HOURLY_RATE_DEFAULT;
      plannedMachineCost += hours * machineRate;

      // Labor rate from cost_rates
      const laborRate = await db('bom.cost_rates').where({ product_id: bomProduct.id, rate_type: 'labor' }).first();
      plannedLaborCost += hours * (laborRate ? Number(laborRate.rate_eur) : LABOR_HOURLY_RATE_DEFAULT);
    }
  }

  // ── SCRAP VALUE RECOVERY (subtract recovered scrap value from material cost) ──
  let scrapValueRecovery = 0;
  if (bomProduct) {
    const opsWithScrap = await db('bom.operations').where('product_id', bomProduct.id).whereNotNull('scrap_percent');
    const mats = await db('bom.materials').where('product_id', bomProduct.id);
    const totalMaterialWeightPerPiece = mats.reduce((s, m) => s + Number(m.qty_per_piece || 0) * Number(m.waste_factor || 1), 0);
    for (const op of opsWithScrap) {
      const scrapPct = Number(op.scrap_percent) || 0;
      const scrapValPerKg = Number(op.scrap_value_per_kg) || 0;
      if (scrapPct > 0 && scrapValPerKg > 0 && op.scrap_type === 'sellable') {
        const scrapWeightPerPiece = totalMaterialWeightPerPiece * scrapPct / 100;
        scrapValueRecovery += scrapWeightPerPiece * scrapValPerKg * order.target_quantity;
      }
    }
  }
  plannedMaterialCost = Math.max(0, plannedMaterialCost - scrapValueRecovery);

  const plannedTotal = plannedMaterialCost + plannedLaborCost + plannedMachineCost;

  // ── ACTUAL COST (from reports + movements + stops) ───────────────────────

  // Pieces done
  const doneResult = await db('production.reports').where('order_id', orderId).sum('good_pieces as done').first();
  const scrapResult = await db('production.reports').where('order_id', orderId).sum('scrap_pieces as scrap').first();
  const piecesDone = Number(doneResult?.done || 0);
  const piecesScrap = Number(scrapResult?.scrap || 0);

  // Material cost from stock movements linked to this order
  const materialMovements = await db('inventory.movements')
    .where({ order_id: orderId, movement_type: 'consumption' })
    .select('quantity', 'unit_cost');
  const actualMaterialCost = materialMovements.reduce((s, m) => s + Number(m.quantity) * Number(m.unit_cost || 0), 0);

  // Machine cost from work order operations (actual)
  const woOps = await db('production.work_order_operations AS woo')
    .join('production.work_orders AS wo', 'woo.work_order_id', 'wo.id')
    .where('wo.order_id', orderId)
    .select('woo.actual_cost_eur', 'woo.planned_cost_eur')
    .catch(() => []);
  const actualMachineCost = woOps.reduce((s, op) => s + Number(op.actual_cost_eur || op.planned_cost_eur || 0), 0);

  // HR cost from hr_allocations
  const hrAllocs = await db('production.hr_allocations as ha')
    .join('production.work_orders as wo', 'ha.work_order_id', 'wo.id')
    .where('wo.order_id', orderId)
    .sum('ha.actual_cost_eur as total').first()
    .catch(() => null);
  const actualLaborCost = Number(hrAllocs?.total || 0);

  // Downtime cost — sum stops for machines that reported on this order
  // production.stops may not have order_id, so we join via machine + order's reports
  const stopsResult = await db('production.stops as s')
    .join(
      db('production.reports').where('order_id', orderId).distinct('machine_id').as('rpt'),
      's.machine_id', 'rpt.machine_id'
    )
    .whereNotNull('s.duration_minutes')
    .sum(db.raw('s.duration_minutes::numeric * ? / 60', [MACHINE_HOURLY_RATE_DEFAULT]))
    .first()
    .catch(() => null);
  const downtimeCost = Number(Object.values(stopsResult || {})[0] || 0);

  // Scrap cost
  const scrapCost = piecesScrap > 0 && piecesDone > 0
    ? (plannedTotal / order.target_quantity) * piecesScrap
    : 0;

  const actualTotal = actualMaterialCost + actualMachineCost + actualLaborCost + downtimeCost + scrapCost;

  // ── ESTIMATED FINAL ──────────────────────────────────────────────────────
  const progress = order.target_quantity > 0 ? piecesDone / order.target_quantity : 0;
  const estimatedFinal = progress > 0 ? actualTotal / progress : plannedTotal;

  // ── COST PER PIECE ────────────────────────────────────────────────────────
  const costPerPiecePlanned = order.target_quantity > 0 ? plannedTotal / order.target_quantity : null;
  const costPerPieceActual = piecesDone > 0 ? actualTotal / piecesDone : null;

  return {
    order_id: orderId,
    order_number: order.order_number,
    product_name: order.product_name,
    pieces_done: piecesDone,
    pieces_target: order.target_quantity,
    progress_pct: Math.round(progress * 100),
    planned: {
      total: Math.round(plannedTotal * 100) / 100,
      material: Math.round(plannedMaterialCost * 100) / 100,
      machine: Math.round(plannedMachineCost * 100) / 100,
      labor: Math.round(plannedLaborCost * 100) / 100,
    },
    actual: {
      total: Math.round(actualTotal * 100) / 100,
      material: Math.round(actualMaterialCost * 100) / 100,
      machine: Math.round(actualMachineCost * 100) / 100,
      labor: Math.round(actualLaborCost * 100) / 100,
      downtime: Math.round(downtimeCost * 100) / 100,
      scrap: Math.round(scrapCost * 100) / 100,
    },
    estimated_final: Math.round(estimatedFinal * 100) / 100,
    cost_per_piece_planned: costPerPiecePlanned ? Math.round(costPerPiecePlanned * 100) / 100 : null,
    cost_per_piece_actual: costPerPieceActual ? Math.round(costPerPieceActual * 100) / 100 : null,
    variance_pct: plannedTotal > 0 ? Math.round((actualTotal - plannedTotal) / plannedTotal * 100) : null,
  };
}

export async function saveSnapshot(orderId) {
  const cost = await calculateOrderCost(orderId);
  if (!cost) return null;
  const [snap] = await db('costs.cost_snapshots').insert({
    order_id: orderId,
    planned_total: cost.planned.total,
    actual_total: cost.actual.total,
    estimated_final: cost.estimated_final,
    scrap_cost: cost.actual.scrap,
    downtime_cost: cost.actual.downtime,
    overtime_cost: 0,
    material_variance: cost.actual.material - cost.planned.material,
    breakdown: JSON.stringify(cost),
    pieces_done: cost.pieces_done,
    pieces_target: cost.pieces_target,
    cost_per_piece_planned: cost.cost_per_piece_planned,
    cost_per_piece_actual: cost.cost_per_piece_actual,
  }).returning('*');
  return snap;
}

export async function listSnapshots({ orderId, dateFrom, dateTo }) {
  let q = db('costs.cost_snapshots').orderBy('snapshot_at', 'desc');
  if (orderId) q = q.where('order_id', orderId);
  if (dateFrom) q = q.where('snapshot_at', '>=', dateFrom);
  if (dateTo) q = q.where('snapshot_at', '<=', dateTo);
  return q;
}

export async function getCostByProduct(productId) {
  const product = await db('bom.products').where('id', productId).first();
  if (!product) return null;

  const orders = await db('production.orders').where('product_code', product.reference);
  if (!orders.length) return { product, orders: [], avg_cost_per_piece: null };

  const costs = await Promise.all(orders.map(o => calculateOrderCost(o.id)));
  const withCost = costs.filter(Boolean);
  const withActual = withCost.filter(c => c.cost_per_piece_actual);
  const avgActual = withActual.length
    ? withActual.reduce((s, c) => s + c.cost_per_piece_actual, 0) / withActual.length
    : 0;

  return {
    product,
    orders: withCost,
    avg_cost_per_piece_planned: withCost[0]?.cost_per_piece_planned || null,
    avg_cost_per_piece_actual: Math.round(avgActual * 100) / 100,
  };
}

export async function getCostByMachine({ dateFrom, dateTo, machineId }) {
  const machineCostDefaults = await _getCostDefaults();
  const MACHINE_HOURLY_RATE_DEFAULT = machineCostDefaults.defaultMachineHourlyRate || 25;

  let q = db('production.reports as r')
    .join('machines.machines as m', 'r.machine_id', 'm.id')
    .select(
      'm.id as machine_id', 'm.code as machine_code', 'm.name as machine_name',
      db.raw('SUM(r.good_pieces) as good_pieces'),
      db.raw('SUM(r.scrap_pieces) as scrap_pieces'),
      db.raw('COUNT(DISTINCT date(r.reported_at)) as days_active')
    )
    .whereBetween('r.reported_at', [dateFrom, dateTo])
    .groupBy('m.id', 'm.code', 'm.name');
  if (machineId) q = q.where('r.machine_id', machineId);

  const rows = await q;

  const stops = await db('production.stops as s')
    .join('machines.machines as m', 's.machine_id', 'm.id')
    .select('m.id as machine_id', db.raw('SUM(s.duration_minutes) as stop_minutes'))
    .whereBetween('s.started_at', [dateFrom, dateTo])
    .whereNotNull('s.duration_minutes')
    .groupBy('m.id');
  const stopsMap = {};
  for (const s of stops) stopsMap[s.machine_id] = Number(s.stop_minutes);

  return rows.map(r => {
    const daysActive = Number(r.days_active);
    const operatingHours = daysActive * 24; // total possible hours
    const stopMinutes = stopsMap[r.machine_id] || 0;
    const productiveHours = (operatingHours * 60 - stopMinutes) / 60;
    const machineCost = productiveHours * MACHINE_HOURLY_RATE_DEFAULT;
    const downtimeCost = stopMinutes / 60 * MACHINE_HOURLY_RATE_DEFAULT;
    return {
      machine_code: r.machine_code,
      machine_name: r.machine_name,
      good_pieces: Number(r.good_pieces),
      scrap_pieces: Number(r.scrap_pieces),
      stop_minutes: stopMinutes,
      machine_cost_eur: Math.round(machineCost * 100) / 100,
      downtime_cost_eur: Math.round(downtimeCost * 100) / 100,
    };
  });
}

export async function getCostByOperator({ dateFrom, dateTo, userId }) {
  let q = db('auth.user_cost_rates as ucr')
    .join('auth.users as u', 'ucr.user_id', 'u.id')
    .leftJoin('production.hr_allocations as ha', 'ucr.user_id', 'ha.user_id')
    .leftJoin('production.work_orders as wo', 'ha.work_order_id', 'wo.id')
    .select(
      'u.id as user_id', 'u.full_name',
      'ucr.hourly_rate_eur',
      db.raw('SUM(ha.planned_hours) as total_hours'),
      db.raw('SUM(ha.actual_cost_eur) as total_cost')
    )
    .where('wo.created_at', '>=', dateFrom)
    .where('wo.created_at', '<=', dateTo)
    .groupBy('u.id', 'u.full_name', 'ucr.hourly_rate_eur');
  if (userId) q = q.where('u.id', userId);

  const rows = await q.catch(() => []);
  return rows.map(r => ({
    ...r,
    total_hours: Number(r.total_hours || 0),
    total_cost: Number(r.total_cost || 0),
  }));
}

export async function getProfitability({ clientName, dateFrom, dateTo }) {
  // Based on companies + orders
  let q = db('production.orders as o')
    .leftJoin('companies.companies as c', 'o.client_id', 'c.id')
    .select(
      db.raw('COALESCE(c.name, o.product_name) as client_name'),
      db.raw('COUNT(o.id) as order_count'),
      db.raw('SUM(o.target_quantity) as total_pieces')
    )
    .whereBetween('o.created_at', [dateFrom, dateTo])
    .groupBy(db.raw('COALESCE(c.name, o.product_name)'));
  if (clientName) q = q.where('c.name', 'ilike', `%${escapeLike(clientName)}%`);

  return q.catch(() => []);
}
