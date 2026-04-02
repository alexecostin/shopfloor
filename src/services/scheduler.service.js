import db from '../config/db.js';
import * as shiftService from './shift.service.js';
import { getTenantConfig } from './app-config.service.js';

/**
 * Main scheduling algorithm.
 * Generates a schedule for all active orders within a period.
 */
export async function generateSchedule(configId, periodStart, periodEnd, name, userId) {
  // Create a run record
  const [run] = await db('planning.scheduling_runs').insert({
    name,
    config_id: configId || null,
    run_type: 'standard',
    status: 'running',
    period_start: periodStart,
    period_end: periodEnd,
    created_by: userId,
  }).returning('*');

  try {
    const result = await runAlgorithm(run.id, configId, periodStart, periodEnd);

    await db('planning.scheduling_runs').where('id', run.id).update({
      status: 'completed',
      result_summary: result.summary,
      warnings: JSON.stringify(result.warnings),
      completed_at: new Date(),
    });

    return { runId: run.id, summary: result.summary, warnings: result.warnings };
  } catch (err) {
    await db('planning.scheduling_runs').where('id', run.id).update({
      status: 'failed',
      warnings: JSON.stringify([{ type: 'error', message: err.message }]),
      completed_at: new Date(),
    });
    throw err;
  }
}

async function runAlgorithm(runId, configId, periodStart, periodEnd) {
  // ─── 1. LOAD CONFIGURATION ────────────────────────────────────────────────
  let config = configId ? await db('planning.scheduling_configs').where('id', configId).first() : null;
  if (!config) config = await db('planning.scheduling_configs').where('is_default', true).first();

  const priorities = config?.priorities || [
    { criterion: 'deadline', weight: 40 },
    { criterion: 'utilization', weight: 30 },
    { criterion: 'setup', weight: 20 },
    { criterion: 'cost', weight: 10 },
  ];
  const constraints = config?.constraints || { respect_shifts: true, planning_granularity: 'shift' };

  // Shift constraints — read from scheduling config, then fall back to tenant config
  const tenantConfig = await getTenantConfig(null).catch(() => ({}));
  const maxShiftsPerDay = Number(constraints.max_shifts_per_day) || tenantConfig.defaultMaxShiftsPerDay || 2;
  const overtimePercent = Number(constraints.overtime_percent) || tenantConfig.defaultOvertimePercent || 10;
  const hoursPerShift = tenantConfig.defaultHoursPerShift || 7.5;

  // ─── 2. LOAD DATA ─────────────────────────────────────────────────────────

  // Active orders
  const orders = await db('production.orders').whereIn('status', ['active', 'planned']);

  // Active machines
  const machines = await db('machines.machines').where('status', 'active');

  // BOM products + operations
  const allOperations = await db('bom.operations as op')
    .join('bom.products as p', 'op.product_id', 'p.id')
    .select('op.*', 'p.reference as product_reference', 'p.name as product_name');

  // Machine capabilities (what machine types can do what operations)
  const capabilities = await db('machines.machine_capabilities');

  // Planned maintenance within period
  const maintenance = await db('maintenance.requests')
    .where('status', 'in_progress')
    .whereBetween('created_at', [periodStart, periodEnd])
    .select('machine_id');
  const maintenanceMachines = new Set(maintenance.map(m => m.machine_id));

  // ─── 3. BUILD OPERATIONS TO SCHEDULE ─────────────────────────────────────

  const toSchedule = [];
  const deadlineMap = {}; // orderId → deadline (estimated from creation)

  for (const order of orders) {
    // Find BOM product by product_code
    const bomOps = allOperations.filter(op => op.product_reference === order.product_code);

    // Get remaining pieces
    const doneResult = await db('production.reports').where('order_id', order.id).sum('good_pieces as done').first();
    const done = Number(doneResult?.done || 0);
    const remaining = Math.max(0, order.target_quantity - done);
    if (remaining === 0) continue;

    // Estimate deadline: order created_at + configurable default days
    const created = new Date(order.created_at);
    const deadline = new Date(created);
    deadline.setDate(deadline.getDate() + (tenantConfig.defaultDeadlineDays || 30));
    deadlineMap[order.id] = deadline;

    if (bomOps.length === 0) {
      // No BOM — schedule directly on the machine assigned to the order
      toSchedule.push({
        order,
        operation: null,
        machineType: null,
        assignedMachineId: order.machine_id,
        quantity: remaining,
        deadline,
        piecesPerHour: tenantConfig.defaultPiecesPerHour || 10,
        setupMinutes: 0,
        dependsOn: [],
      });
    } else {
      for (const op of bomOps.sort((a, b) => (a.sequence || 0) - (b.sequence || 0))) {
        const piecesPerHour = op.pieces_per_hour || (op.cycle_time_seconds > 0 ? (3600 / op.cycle_time_seconds) * (op.nr_cavities || 1) : null) || tenantConfig.defaultPiecesPerHour || 10;
        toSchedule.push({
          order,
          operation: op,
          machineType: op.machine_type,
          assignedMachineId: op.machine_id || order.machine_id,
          quantity: remaining,
          deadline,
          piecesPerHour,
          setupMinutes: op.setup_time_minutes || 0,
          dependsOn: [],
        });
      }
    }
  }

  // ─── 4. SCORE AND SORT ────────────────────────────────────────────────────

  const now = new Date();
  const periodEndDate = new Date(periodEnd);
  const maxDays = Math.max(1, (periodEndDate - now) / 86400000);

  const scored = toSchedule.map(item => {
    const daysUntilDeadline = Math.max(0, (item.deadline - now) / 86400000);
    const deadlineScore = (1 - Math.min(daysUntilDeadline / maxDays, 1)) * 100;
    return { ...item, score: deadlineScore };
  });

  scored.sort((a, b) => b.score - a.score);

  // ─── 5. ALLOCATE ──────────────────────────────────────────────────────────

  const warnings = [];
  const scheduledOps = [];

  // Track machine load: machineId → {date → {shift → hours_used}}
  const machineLoad = {};

  function getMachineLoad(machineId, date, shift) {
    if (!machineLoad[machineId]) machineLoad[machineId] = {};
    if (!machineLoad[machineId][date]) machineLoad[machineId][date] = {};
    return machineLoad[machineId][date][shift] || 0;
  }

  function addMachineLoad(machineId, date, shift, hours) {
    if (!machineLoad[machineId]) machineLoad[machineId] = {};
    if (!machineLoad[machineId][date]) machineLoad[machineId][date] = {};
    machineLoad[machineId][date][shift] = (machineLoad[machineId][date][shift] || 0) + hours;
  }

  // Generate daily slots with available hours from shift config
  // Max daily hours per machine: shifts x hoursPerShift x (1 + overtime/100)
  const SHIFT_HOURS_FALLBACK = maxShiftsPerDay * hoursPerShift * (1 + overtimePercent / 100);

  const slots = [];
  let cursor = new Date(periodStart);
  const end = new Date(periodEnd);
  while (cursor <= end) {
    const dateStr = cursor.toISOString().split('T')[0];
    slots.push({ date: dateStr, shift: 'work' }); // one slot per day
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const item of scored) {
    const productionHours = item.quantity / item.piecesPerHour;
    const setupHours = item.setupMinutes / 60;
    let remainingHours = productionHours + setupHours;

    // Find candidate machines
    let candidateMachines = [];
    if (item.assignedMachineId) {
      const m = machines.find(m => m.id === item.assignedMachineId);
      if (m && !maintenanceMachines.has(m.id)) candidateMachines = [m];
    }
    if (candidateMachines.length === 0 && item.machineType) {
      candidateMachines = machines.filter(m => m.type === item.machineType && !maintenanceMachines.has(m.id));
    }
    if (candidateMachines.length === 0) {
      candidateMachines = machines.filter(m => !maintenanceMachines.has(m.id));
    }

    if (candidateMachines.length === 0) {
      warnings.push({ type: 'no_machine', message: `Comanda ${item.order.order_number}: nicio masina disponibila.` });
      continue;
    }

    // Allocate across days — spill to next day when capacity exceeded
    let allocated = false;
    let chosenMachine = null;

    for (const machine of candidateMachines) {
      let hoursLeft = remainingHours;
      const tempOps = [];

      for (const slot of slots) {
        if (hoursLeft <= 0) break;

        // Check if machine has a confirmed planned_intervention on this date
        const maintenanceBlock = await db('maintenance.planned_interventions')
          .where({ machine_id: machine.id, status: 'confirmed' })
          .where('planned_start_date', '<=', slot.date)
          .where('planned_end_date', '>=', slot.date)
          .first()
          .catch(() => null);
        if (maintenanceBlock) continue; // skip this date for this machine

        // Get available hours from shift config, capped by shift constraints
        let dayAvailableHours = SHIFT_HOURS_FALLBACK;
        try {
          const shiftInfo = await shiftService.getAvailableHours(machine.id, slot.date);
          if (shiftInfo.totalHours > 0) {
            // Cap the shift-reported hours by our constraint: maxShifts x hoursPerShift x (1+overtime)
            dayAvailableHours = Math.min(shiftInfo.totalHours, SHIFT_HOURS_FALLBACK);
          }
        } catch (_) { /* use fallback */ }

        const currentLoad = getMachineLoad(machine.id, slot.date, slot.shift);
        const freeHours = Math.max(0, dayAvailableHours - currentLoad);
        if (freeHours <= 0) continue;

        const hoursToAllocate = Math.min(hoursLeft, freeHours);
        const qtyForSlot = remainingHours > 0
          ? Math.round(item.quantity * (hoursToAllocate / (productionHours + setupHours)))
          : item.quantity;

        tempOps.push({
          run_id: runId,
          order_id: item.order.id,
          operation_id: item.operation?.id || null,
          machine_id: machine.id,
          operator_id: null,
          product_name: item.order.product_name,
          product_code: item.order.product_code,
          quantity: Math.max(1, qtyForSlot),
          planned_date: slot.date,
          planned_shift: 'work',
          sequence: item.operation?.sequence || 0,
          setup_minutes: tempOps.length === 0 ? item.setupMinutes : 0,
          planned_hours: Math.round(hoursToAllocate * 100) / 100,
          status: 'planned',
          dependency_met: true,
        });

        hoursLeft -= hoursToAllocate;
      }

      if (hoursLeft <= 0) {
        // Successfully allocated all hours on this machine
        for (const op of tempOps) {
          scheduledOps.push(op);
          addMachineLoad(op.machine_id, op.planned_date, 'work', op.planned_hours);
        }
        allocated = true;
        chosenMachine = machine;
        break;
      }
    }

    if (!allocated) {
      warnings.push({ type: 'not_scheduled', message: `Comanda ${item.order.order_number}: nu s-a putut aloca in perioada specificata.` });
    }

    // Check deadline warning
    if (allocated) {
      const lastOps = scheduledOps.filter(op => op.order_id === item.order.id);
      const last = lastOps[lastOps.length - 1];
      if (last) {
        const lastDate = new Date(last.planned_date);
        if (lastDate > item.deadline) {
          warnings.push({ type: 'deadline_risk', message: `Comanda ${item.order.order_number}: planificata dupa deadline (${item.deadline.toISOString().split('T')[0]}).` });
        }
      }
    }
  }

  // ─── 6. INSERT SCHEDULED OPERATIONS ──────────────────────────────────────
  if (scheduledOps.length > 0) {
    // Insert in chunks to avoid parameter limit
    const chunkSize = 50;
    for (let i = 0; i < scheduledOps.length; i += chunkSize) {
      await db('planning.scheduled_operations').insert(scheduledOps.slice(i, i + chunkSize));
    }
  }

  // ─── 7. CALCULATE SUMMARY ─────────────────────────────────────────────────
  const totalOps = toSchedule.length;
  const scheduledCount = scheduledOps.length;
  const onTime = scheduledOps.filter(op => {
    const order = orders.find(o => o.id === op.order_id);
    if (!order) return true;
    const deadline = deadlineMap[order.id];
    return !deadline || new Date(op.planned_date) <= deadline;
  }).length;

  // Machine load averages
  const loadValues = [];
  for (const mId of Object.keys(machineLoad)) {
    for (const date of Object.keys(machineLoad[mId])) {
      for (const shift of Object.keys(machineLoad[mId][date])) {
        loadValues.push(Math.min(100, machineLoad[mId][date][shift] / SHIFT_HOURS_FALLBACK * 100));
      }
    }
  }
  const avgLoad = loadValues.length > 0 ? Math.round(loadValues.reduce((s, v) => s + v, 0) / loadValues.length) : 0;

  const summary = {
    total_operations: totalOps,
    scheduled: scheduledCount,
    not_scheduled: totalOps - scheduledCount,
    on_time: onTime,
    on_time_pct: scheduledCount > 0 ? Math.round(onTime / scheduledCount * 100) : 0,
    avg_load_pct: avgLoad,
    warnings_count: warnings.length,
  };

  return { summary, warnings };
}
