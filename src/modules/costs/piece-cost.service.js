import db from '../../config/db.js';
import { getMachineCostConfig, getEffectiveHourlyRate, getOperatorHourlyRate, listElements, listOverhead } from './cost-config.service.js';
import { getTenantConfig } from '../../services/app-config.service.js';

export async function calculatePieceCost(productId, options = {}) {
  const { machineId, operatorId, quantity = 1, tenantId } = options;

  // Get active cost elements
  const elements = await listElements(tenantId);
  const activeElements = elements.filter(e => e.is_active);
  const elementMap = Object.fromEntries(activeElements.map(e => [e.element_code, e]));

  // Get BOM product + operations
  const product = await db('bom.products').where({ id: productId }).first();
  if (!product) return null;

  const operations = await db('bom.operations').where({ product_id: productId }).catch(() => []);
  const materials = await db('bom.materials').where({ product_id: productId }).catch(() => []);

  const result = {
    elements: [],
    subtotal: 0,
    overhead: 0,
    total: 0,
    perPiece: 0,
    perOrder: 0,
  };

  // MACHINE COST
  if (elementMap['machine_hourly'] && machineId) {
    const config = await getMachineCostConfig(machineId);
    const hourlyRate = getEffectiveHourlyRate(config);
    const totalHours = operations.reduce((s, op) => {
      if (op.machine_id === machineId || !op.machine_id) {
        return s + (parseFloat(op.cycle_time_seconds) || 0) / 3600;
      }
      return s;
    }, 0);
    const value = hourlyRate * totalHours;
    result.elements.push({ code: 'machine_hourly', name: 'Cost orar masina', category: 'machine', value });
    result.subtotal += value;
  }

  // LABOR COST
  if (elementMap['labor_hourly'] && operatorId) {
    const hourlyRate = await getOperatorHourlyRate(operatorId, tenantId);
    const totalHours = operations.reduce((s, op) => s + (parseFloat(op.cycle_time_seconds) || 0) / 3600, 0);
    const value = hourlyRate * totalHours;
    result.elements.push({ code: 'labor_hourly', name: 'Cost orar manopera', category: 'labor', value });
    result.subtotal += value;
  }

  // MATERIAL COST
  if (elementMap['material_direct'] && materials.length > 0) {
    let matCost = 0;
    for (const mat of materials) {
      const supplier = await db('inventory.item_suppliers')
        .where({ item_id: mat.item_id, is_primary: true }).first().catch(() => null);
      const unitCost = supplier ? parseFloat(supplier.unit_cost) : 0;
      const wasteFactor = parseFloat(mat.waste_factor) || 1;
      matCost += (parseFloat(mat.quantity_per_piece) || 0) * wasteFactor * unitCost;
    }
    result.elements.push({ code: 'material_direct', name: 'Cost materiale directe', category: 'material', value: matCost });
    result.subtotal += matCost;
  }

  // TOOLING AMORTIZATION
  if (elementMap['tooling_amortization'] && machineId) {
    const tools = await db('machines.tools')
      .where({ machine_id: machineId, status: 'active' }).catch(() => []);
    const toolCost = tools.reduce((s, t) => {
      const pc = parseFloat(t.purchase_cost) || 0;
      const mc = parseInt(t.max_cycles) || 1;
      return s + pc / mc;
    }, 0);
    result.elements.push({ code: 'tooling_amortization', name: 'Amortizare scule/matrite', category: 'tooling', value: toolCost });
    result.subtotal += toolCost;
  }

  // ENERGY (only if detailed config)
  if (elementMap['energy'] && machineId) {
    const config = await getMachineCostConfig(machineId);
    if (config?.config_mode === 'detailed' && config.power_kw && config.energy_price_per_kwh) {
      const totalHours = operations.reduce((s, op) => s + (parseFloat(op.cycle_time_seconds) || 0) / 3600, 0);
      const energyCost = parseFloat(config.power_kw) * totalHours * parseFloat(config.energy_price_per_kwh);
      result.elements.push({ code: 'energy', name: 'Energie electrica', category: 'energy', value: energyCost });
      result.subtotal += energyCost;
    }
  }

  // OVERHEAD
  if (elementMap['overhead']) {
    const overheadConfigs = await listOverhead(tenantId);
    const activeOverhead = overheadConfigs.filter(o => o.is_active);
    let overheadTotal = 0;
    const pieceCostConfig = await getTenantConfig(tenantId).catch(() => ({}));
    const estimatedMonthlyPieces = pieceCostConfig.defaultMonthlyPiecesEstimate || 1000;
    for (const oh of activeOverhead) {
      if (oh.overhead_type === 'percentage') {
        overheadTotal += result.subtotal * (parseFloat(oh.value) / 100);
      } else if (oh.overhead_type === 'fixed_monthly') {
        overheadTotal += parseFloat(oh.value) / estimatedMonthlyPieces;
      } else if (oh.overhead_type === 'per_piece') {
        overheadTotal += parseFloat(oh.value);
      }
    }
    result.overhead = overheadTotal;
    result.elements.push({ code: 'overhead', name: 'Overhead fabrica', category: 'overhead', value: overheadTotal });
  }

  result.total = result.subtotal + result.overhead;
  result.perPiece = result.total;
  result.perOrder = result.total * quantity;

  return result;
}

export async function calculateOrderCostComplete(orderId, tenantId) {
  // Get work order
  const order = await db('production.work_orders').where({ id: orderId }).first().catch(async () => {
    return db('production.orders').where({ id: orderId }).first().catch(() => null);
  });
  if (!order) return null;

  const productId = order.product_id || order.bom_product_id;
  const machineId = order.machine_id;
  const quantity = order.target_quantity || order.quantity || 1;
  const sellingPrice = parseFloat(order.selling_price_per_piece) || 0;

  const pieceCost = await calculatePieceCost(productId, { machineId, quantity, tenantId });
  if (!pieceCost) return null;

  const totalCost = pieceCost.perPiece * quantity;
  const revenue = sellingPrice * quantity;
  const margin = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : null;

  return {
    orderId,
    quantity,
    pieceCost: pieceCost.perPiece,
    totalCost,
    revenue,
    margin: margin ? Math.round(margin * 100) / 100 : null,
    breakdown: {
      byCategory: pieceCost.elements.reduce((acc, el) => {
        acc[el.category] = (acc[el.category] || 0) + el.value;
        return acc;
      }, {}),
      elements: pieceCost.elements,
      subtotal: pieceCost.subtotal,
      overhead: pieceCost.overhead,
    },
  };
}
