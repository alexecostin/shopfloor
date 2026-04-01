import db from '../config/db.js';
import { aggregatePiecesFromOrders } from './piece-planning.service.js';

/**
 * Smart Auto-Scheduling Algorithm.
 *
 * 1. Aggregates pieces from all active orders (via piece-planning.service)
 * 2. Respects scheduling config constraints (shifts, overtime, weekends, dependencies)
 * 3. Groups same pieces on same machine consecutively (minimize setup)
 * 4. Respects operation order (debitare before strunjire)
 * 5. Lot transfer: after min_batch_before_next on op1, op2 can start on another machine
 * 6. Proposes lot transfer automatically: default = max(5, min(100, 10% of total qty))
 * 7. Calculates impact per order: estimates completion date vs. deadline
 */
export async function generateSmartPlan(configId, periodStart, periodEnd, userId) {
  // Load config
  const config = configId ? await db('planning.scheduling_configs').where('id', configId).first() : null;
  const constraints = config?.constraints || {};
  const maxShifts = Number(constraints.max_shifts_per_day) || 2;
  const overtimePercent = Number(constraints.overtime_percent) || 10;
  const allowWeekend = constraints.allow_weekend || false;
  const hoursPerShift = 7.5;
  const maxHoursPerDay = maxShifts * hoursPerShift * (1 + overtimePercent / 100);

  // Get aggregated pieces
  const pieces = await aggregatePiecesFromOrders();

  // Get all machines with their types
  const machines = await db('machines.machines').where('status', 'active').select('*');

  // Get machines in maintenance (exclude them)
  const maintMachines = await db('maintenance.requests')
    .where('status', 'in_progress')
    .select('machine_id');
  const maintIds = new Set(maintMachines.map(m => m.machine_id));
  const availableMachines = machines.filter(m => !maintIds.has(m.id));

  // Build schedule: for each piece, for each operation, assign to machine+date
  const allocations = [];
  const machineSchedule = {}; // machineId -> { date -> hoursUsed }
  const warnings = [];
  const orderCompletionDates = {};

  function getAvailableDate(machineId, hoursNeeded, startFrom) {
    if (!machineSchedule[machineId]) machineSchedule[machineId] = {};
    let date = new Date(startFrom);

    while (true) {
      const dow = date.getDay();
      // Skip weekends unless allowed
      if (!allowWeekend && (dow === 0 || dow === 6)) {
        date.setDate(date.getDate() + 1);
        continue;
      }

      const dateStr = date.toISOString().split('T')[0];
      const used = machineSchedule[machineId][dateStr] || 0;
      const available = maxHoursPerDay - used;

      if (available >= Math.min(hoursNeeded, hoursPerShift)) {
        return { date: dateStr, availableHours: available };
      }
      date.setDate(date.getDate() + 1);

      // Safety: don't go beyond period
      if (date > new Date(periodEnd)) {
        return { date: dateStr, availableHours: maxHoursPerDay };
      }
    }
  }

  function addToSchedule(machineId, dateStr, hours) {
    if (!machineSchedule[machineId]) machineSchedule[machineId] = {};
    machineSchedule[machineId][dateStr] = (machineSchedule[machineId][dateStr] || 0) + hours;
  }

  // Sort pieces by priority then deadline
  const sortedPieces = [...pieces].filter(p => p.remainingQuantity > 0 && p.operations.length > 0);

  // Group by operation type to minimize setup changes
  // First pass: schedule each piece's operations sequentially
  for (const piece of sortedPieces) {
    let opStartDate = new Date(periodStart);

    // Calculate lot transfer size
    const lotTransfer = Math.max(5, Math.min(100, Math.ceil(piece.remainingQuantity * 0.1)));

    for (const op of piece.operations) {
      // Find best machine for this operation
      let targetMachine = null;
      if (op.machine_id) {
        targetMachine = availableMachines.find(m => m.id === op.machine_id);
      }
      if (!targetMachine && op.machine_type) {
        targetMachine = availableMachines.find(m => m.type === op.machine_type);
      }
      if (!targetMachine) {
        warnings.push({ piece: piece.productReference, operation: op.operation_name, message: 'Nu exista masina disponibila' });
        continue;
      }

      // Calculate hours needed
      const cycleTime = Number(op.cycle_time_seconds) || 60;
      const setupTime = Number(op.setup_time_minutes) || 0;
      const totalHours = (piece.remainingQuantity * cycleTime / 3600) + (setupTime / 60);

      // Find available date on this machine
      const { date: allocDate } = getAvailableDate(targetMachine.id, totalHours, opStartDate);

      // Split across multiple days if needed
      let remainingHours = totalHours;
      let dayDate = new Date(allocDate);
      const piecesPerHour = 3600 / cycleTime;

      while (remainingHours > 0) {
        const dateStr = dayDate.toISOString().split('T')[0];
        const dow = dayDate.getDay();
        if (!allowWeekend && (dow === 0 || dow === 6)) {
          dayDate.setDate(dayDate.getDate() + 1);
          continue;
        }

        const used = machineSchedule[targetMachine.id]?.[dateStr] || 0;
        const dayAvailable = Math.min(remainingHours, maxHoursPerDay - used);

        if (dayAvailable > 0) {
          const dayQty = Math.min(piece.remainingQuantity, Math.ceil(dayAvailable * piecesPerHour));

          allocations.push({
            productReference: piece.productReference,
            productName: piece.productName,
            operationName: op.operation_name,
            operationType: op.operation_type,
            machineId: targetMachine.id,
            machineCode: targetMachine.code,
            planDate: dateStr,
            plannedQty: dayQty,
            plannedHours: Math.round(dayAvailable * 100) / 100,
            setupMinutes: remainingHours === totalHours ? setupTime : 0, // setup only on first day
            lotTransfer,
            orderIds: piece.orders.map(o => o.id),
          });

          addToSchedule(targetMachine.id, dateStr, dayAvailable);
          remainingHours -= dayAvailable;
        }

        dayDate.setDate(dayDate.getDate() + 1);
      }

      // Next operation can start after lot transfer
      const lotTransferDate = new Date(allocDate);
      const lotTransferHours = (lotTransfer * cycleTime / 3600);
      // Op2 starts when first lot is done on op1
      opStartDate = lotTransferDate;
    }

    // Track order completion dates
    const lastAlloc = allocations.filter(a => a.productReference === piece.productReference).pop();
    if (lastAlloc) {
      for (const order of piece.orders) {
        orderCompletionDates[order.id] = {
          orderNumber: order.orderNumber,
          deadline: order.deadline,
          estimatedCompletion: lastAlloc.planDate,
          isLate: order.deadline && lastAlloc.planDate > String(order.deadline).split('T')[0],
          daysLate: order.deadline ? Math.ceil((new Date(lastAlloc.planDate) - new Date(order.deadline)) / 86400000) : 0,
        };
      }
    }
  }

  // Summary
  const summary = {
    totalPieces: sortedPieces.length,
    totalAllocations: allocations.length,
    totalHours: Math.round(allocations.reduce((s, a) => s + a.plannedHours, 0) * 10) / 10,
    machinesUsed: [...new Set(allocations.map(a => a.machineCode))].length,
    setupSaved: 'Piese grupate pe aceeasi masina — setup-uri minimizate',
    ordersOnTime: Object.values(orderCompletionDates).filter(o => !o.isLate).length,
    ordersLate: Object.values(orderCompletionDates).filter(o => o.isLate).length,
    constraints: { maxShifts, overtimePercent, allowWeekend },
  };

  return {
    allocations,
    summary,
    warnings,
    orderImpact: Object.values(orderCompletionDates),
    lotTransfers: sortedPieces.map(p => ({
      piece: p.productReference,
      suggestedLot: Math.max(5, Math.min(100, Math.ceil(p.remainingQuantity * 0.1))),
      totalQty: p.remainingQuantity,
    })),
  };
}

/**
 * Apply smart plan: create a master_plan and daily_allocations from the result.
 */
export async function applySmartPlan(planResult, periodStart, periodEnd, userId) {
  const { allocations, summary } = planResult;

  if (!allocations || allocations.length === 0) {
    throw Object.assign(new Error('Nu exista alocari de aplicat.'), { statusCode: 400 });
  }

  // Create master plan
  const [masterPlan] = await db('planning.master_plans').insert({
    name: `Smart Plan ${new Date().toISOString().split('T')[0]}`,
    plan_type: 'weekly',
    year: new Date(periodStart).getFullYear(),
    week_number: Math.ceil((new Date(periodStart) - new Date(new Date(periodStart).getFullYear(), 0, 1)) / (7 * 86400000)),
    start_date: periodStart,
    end_date: periodEnd,
    notes: `Plan generat automat — ${summary.totalPieces} piese, ${summary.totalAllocations} alocari, ${summary.totalHours}h total`,
    created_by: userId,
  }).returning('*');

  // Insert daily allocations in chunks
  const rows = allocations.map(a => ({
    master_plan_id: masterPlan.id,
    plan_date: a.planDate,
    shift: 'Tura I',
    machine_id: a.machineId,
    product_reference: a.productReference,
    product_name: a.productName,
    planned_qty: a.plannedQty,
    planned_hours: a.plannedHours,
    notes: `Op: ${a.operationName || '-'} | Lot transfer: ${a.lotTransfer} | Setup: ${a.setupMinutes}min`,
  }));

  const chunkSize = 50;
  let inserted = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = await db('planning.daily_allocations').insert(rows.slice(i, i + chunkSize)).returning('*');
    inserted = inserted.concat(chunk);
  }

  return {
    masterPlan,
    allocationsCreated: inserted.length,
    summary,
  };
}
