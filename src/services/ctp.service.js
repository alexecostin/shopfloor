import db from '../config/db.js';
import * as shiftService from './shift.service.js';

/**
 * Estimate earliest completion date for a given product and quantity.
 * Takes into account: MBOM operations, machine availability, current load, shifts.
 */
export async function estimateDelivery(productReference, quantity, options = {}) {
  const maxShifts = options.maxShiftsPerDay || 2;
  const overtimePercent = options.overtimePercent || 10;

  // Find BOM product and operations
  const product = await db('bom.products').where('reference', productReference).first();
  if (!product) return { error: 'Produs negasit in BOM', canDeliver: false };

  const operations = await db('bom.operations')
    .where('product_id', product.id)
    .where('is_active', true)
    .orderBy('sequence');

  if (operations.length === 0) return { error: 'MBOM nedefinit — nicio operatie', canDeliver: false };

  // Calculate total time needed per operation
  let totalHours = 0;
  const breakdown = [];

  for (const op of operations) {
    const cycleTimeSec = Number(op.cycle_time_seconds) || 60;
    const setupMin = Number(op.setup_time_minutes) || 0;
    const productionHours = (quantity * cycleTimeSec / 3600) + (setupMin / 60);
    totalHours += productionHours;

    breakdown.push({
      operation: op.operation_name,
      machineType: op.machine_type,
      machineId: op.machine_id,
      cycleTimeSec,
      setupMin,
      productionHours: Math.round(productionHours * 10) / 10,
    });
  }

  // Available hours per day: shifts × hours per shift × (1 + overtime)
  const hoursPerShift = 7.5; // default, should come from shift config
  const availableHoursPerDay = maxShifts * hoursPerShift * (1 + overtimePercent / 100);

  // Rough estimate: sequential operations
  const workingDays = Math.ceil(totalHours / availableHoursPerDay);

  // Skip weekends
  const startDate = new Date();
  let daysAdded = 0;
  const estimatedDate = new Date(startDate);
  while (daysAdded < workingDays) {
    estimatedDate.setDate(estimatedDate.getDate() + 1);
    const dow = estimatedDate.getDay();
    if (dow !== 0 && dow !== 6) daysAdded++; // skip weekends
  }

  // Check current machine load
  let loadWarning = null;
  const currentAllocations = await db('planning.daily_allocations')
    .where('plan_date', '>=', new Date().toISOString().split('T')[0])
    .whereNot('status', 'cancelled')
    .sum('planned_hours as total')
    .catch(() => [{ total: 0 }]);
  const currentLoad = Number(currentAllocations[0]?.total) || 0;
  if (currentLoad > 0) {
    loadWarning = `Incarcare curenta: ${Math.round(currentLoad)}h planificate. Estimarea poate fi afectata.`;
  }

  return {
    canDeliver: true,
    product: { reference: product.reference, name: product.name },
    quantity,
    totalProductionHours: Math.round(totalHours * 10) / 10,
    workingDays,
    estimatedDate: estimatedDate.toISOString().split('T')[0],
    availableHoursPerDay: Math.round(availableHoursPerDay * 10) / 10,
    maxShifts,
    overtimePercent,
    breakdown,
    loadWarning,
  };
}
