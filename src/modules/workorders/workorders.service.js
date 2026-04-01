import db from '../../config/db.js';
import * as orderStatusSvc from '../../services/order-status.service.js';

async function nextWONumber() {
  const [{ nextval }] = await db.raw("SELECT nextval('production.work_order_seq')");
  return `CL-${String(nextval).padStart(5, '0')}`;
}

// ─── Work Orders ─────────────────────────────────────────────────────────────

export async function listWorkOrders({ orderId, status, priority, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  let q = db('production.work_orders');
  if (orderId) q = q.where('order_id', orderId);
  if (status) q = q.where('status', status);
  if (priority) q = q.where('priority', priority);
  const [{ count }] = await q.clone().count('* as count');
  const data = await q.clone().orderBy('created_at', 'desc').limit(limit).offset(offset);
  return { data, total: Number(count), page, limit };
}

export async function getWorkOrder(id) {
  const wo = await db('production.work_orders').where({ id }).first();
  if (!wo) return null;
  const [operations, hrAllocations] = await Promise.all([
    db('production.work_order_operations').where({ work_order_id: id }).orderBy('sequence'),
    db('production.hr_allocations').where({ work_order_id: id }),
  ]);
  // Cost total
  const totalPlannedCost = [
    ...operations.map(op => Number(op.planned_cost_eur) || 0),
    ...hrAllocations.map(h => Number(h.planned_cost_eur) || 0),
  ].reduce((s, v) => s + v, 0);
  const totalActualCost = [
    ...operations.map(op => Number(op.actual_cost_eur) || 0),
    ...hrAllocations.map(h => Number(h.actual_cost_eur) || 0),
  ].reduce((s, v) => s + v, 0);
  return { ...wo, operations, hrAllocations, totalPlannedCost, totalActualCost };
}

export async function createWorkOrder(data, userId) {
  const number = await nextWONumber();
  const rows = await db('production.work_orders').insert({
    work_order_number: number,
    order_id: data.orderId || null,
    order_number: data.orderNumber || null,
    product_id: data.productId || null,
    product_reference: data.productReference || null,
    product_name: data.productName || null,
    client_id: data.clientId || null,
    quantity: data.quantity,
    priority: data.priority || 'normal',
    scheduled_start: data.scheduledStart || null,
    scheduled_end: data.scheduledEnd || null,
    created_by: userId,
    notes: data.notes || null,
  }).returning('*');
  const wo = Array.isArray(rows) ? rows[0] : rows;

  // Daca exista un produs BOM, preincarca operatiile automat
  if (data.productId || data.productReference) {
    const product = data.productId
      ? await db('bom.products').where({ id: data.productId }).first()
      : await db('bom.products').where({ reference: data.productReference }).first();

    if (product) {
      const bomOps = await db('bom.operations')
        .where({ product_id: product.id, is_active: true })
        .orderBy('sequence');

      for (const op of bomOps) {
        // Gaseste masina preferata din alternatives sau foloseste machine_id din BOM
        let machine = null;
        const preferredAlt = await db('bom.operation_alternatives')
          .where({ operation_id: op.id, is_preferred: true })
          .first();
        if (preferredAlt) {
          machine = await db('machines.machines').where({ id: preferredAlt.machine_id }).first();
        } else if (op.machine_id) {
          machine = await db('machines.machines').where({ id: op.machine_id }).first();
        }

        // Calculeaza ore planificate
        const pph = op.pieces_per_hour || 1;
        const plannedHours = ((data.quantity || 1) / pph) + ((op.setup_time_minutes || 0) / 60);

        // Cost orar din capabilitati masina
        let hourlyRate = 0;
        if (machine) {
          const cap = await db('machines.machine_capabilities')
            .where({ machine_id: machine.id, operation_type: op.operation_type })
            .first();
          hourlyRate = Number(cap?.hourly_rate_eur || 0);
          if (!hourlyRate) {
            const bomRate = await db('bom.cost_rates')
              .where({ rate_type: 'machine_hourly', reference_id: machine.id })
              .orderBy('valid_from', 'desc').first();
            hourlyRate = Number(bomRate?.rate_eur_per_hour || 0);
          }
        }

        await db('production.work_order_operations').insert({
          work_order_id: wo.id,
          sequence: op.sequence,
          bom_operation_id: op.id,
          operation_name: op.operation_name,
          operation_type: op.operation_type,
          machine_id: machine?.id,
          machine_code: machine?.code,
          machine_name: machine?.name,
          cycle_time_seconds: op.cycle_time_seconds,
          nr_cavities: op.nr_cavities,
          pieces_per_hour: pph,
          setup_time_minutes: op.setup_time_minutes,
          planned_hours: Math.round(plannedHours * 100) / 100,
          hourly_rate_eur: hourlyRate,
          planned_cost_eur: Math.round(plannedHours * hourlyRate * 100) / 100,
        });
      }
    }
  }

  return getWorkOrder(wo.id);
}

export async function updateWorkOrder(id, data, tenantId) {
  const row = {};
  const map = {
    status: 'status', priority: 'priority', scheduledStart: 'scheduled_start',
    scheduledEnd: 'scheduled_end', notes: 'notes', quantity: 'quantity',
  };
  for (const [k, v] of Object.entries(map)) {
    if (data[k] !== undefined) row[v] = data[k];
  }
  if (data.status) {
    const current = await db('production.work_orders').where('id', id).first();
    if (current && current.status !== data.status) {
      await orderStatusSvc.validateTransition(tenantId, current.status, data.status);
    }
  }
  if (data.status === 'in_progress' && !row.actual_start) row.actual_start = new Date();
  if (data.status === 'completed') row.actual_end = new Date();
  row.updated_at = new Date();
  const rows = await db('production.work_orders').where({ id }).update(row).returning('*');
  const wo = Array.isArray(rows) ? rows[0] : rows;
  return wo;
}

export async function changeStatus(tenantId, id, toStatus) {
  const current = await db('production.work_orders').where('id', id).first();
  if (!current) throw new Error('Comanda negasita');
  if (current.status === toStatus) return current;
  await orderStatusSvc.validateTransition(tenantId, current.status, toStatus);
  const rows = await db('production.work_orders')
    .where('id', id)
    .update({ status: toStatus, updated_at: db.fn.now() })
    .returning('*');
  const updated = Array.isArray(rows) ? rows[0] : rows;
  return updated;
}

export async function getNextStatuses(tenantId, id) {
  const wo = await db('production.work_orders').where('id', id).first();
  if (!wo) return [];
  return orderStatusSvc.getNextStatuses(tenantId, wo.status);
}

export async function getAllStatuses(tenantId) {
  return orderStatusSvc.getStatuses(tenantId);
}

// ─── Work Order Operations ────────────────────────────────────────────────────

export async function updateOperation(id, data) {
  const row = {};
  const map = {
    machineId: 'machine_id', operatorId: 'operator_id',
    plannedHours: 'planned_hours', actualHours: 'actual_hours',
    status: 'status', notes: 'notes', hourlyRateEur: 'hourly_rate_eur',
  };
  for (const [k, v] of Object.entries(map)) {
    if (data[k] !== undefined) row[v] = data[k];
  }
  // Denormalize machine/operator
  if (data.machineId) {
    const m = await db('machines.machines').where({ id: data.machineId }).first();
    if (m) { row.machine_code = m.code; row.machine_name = m.name; }
  }
  if (data.operatorId) {
    const u = await db('auth.users').where({ id: data.operatorId }).first();
    if (u) row.operator_name = u.full_name;
  }
  // Recalculeaza costuri
  const op = await db('production.work_order_operations').where({ id }).first();
  const hours = data.plannedHours ?? op.planned_hours;
  const rate = data.hourlyRateEur ?? op.hourly_rate_eur;
  if (hours && rate) row.planned_cost_eur = Math.round(Number(hours) * Number(rate) * 100) / 100;
  if (data.actualHours && rate) row.actual_cost_eur = Math.round(Number(data.actualHours) * Number(rate) * 100) / 100;

  if (data.status === 'in_progress') row.started_at = new Date();
  if (data.status === 'completed') row.completed_at = new Date();

  const rows = await db('production.work_order_operations').where({ id }).update(row).returning('*');
  const updated = Array.isArray(rows) ? rows[0] : rows;
  return updated;
}

// ─── HR Allocations ──────────────────────────────────────────────────────────

export async function addHrAllocation(workOrderId, data) {
  const user = await db('auth.users').where({ id: data.userId }).first();
  if (!user) throw Object.assign(new Error('Angajat negasit.'), { status: 404 });

  // Cost orar din tabela user_cost_rates sau implicit 0
  let hourlyRate = Number(data.hourlyRateEur || 0);
  if (!hourlyRate) {
    const rate = await db('auth.user_cost_rates')
      .where({ user_id: data.userId })
      .where('valid_from', '<=', new Date())
      .where(q => q.whereNull('valid_to').orWhere('valid_to', '>=', new Date()))
      .orderBy('valid_from', 'desc').first();
    if (!rate) {
      const roleRate = await db('auth.user_cost_rates')
        .where({ role: user.role })
        .whereNull('user_id')
        .where('valid_from', '<=', new Date())
        .orderBy('valid_from', 'desc').first();
      hourlyRate = Number(roleRate?.hourly_rate_eur || 0);
    } else {
      hourlyRate = Number(rate.hourly_rate_eur);
    }
  }

  const hours = Number(data.allocatedHours);
  const allocRows = await db('production.hr_allocations').insert({
    work_order_id: workOrderId,
    work_order_operation_id: data.workOrderOperationId,
    user_id: data.userId,
    user_name: user.full_name,
    role_at_time: user.role,
    hourly_rate_eur: hourlyRate,
    allocated_hours: hours,
    actual_hours: data.actualHours,
    planned_cost_eur: Math.round(hours * hourlyRate * Number(data.overheadFactor || 1) * 100) / 100,
    actual_cost_eur: data.actualHours ? Math.round(Number(data.actualHours) * hourlyRate * 100) / 100 : null,
    allocation_date: data.allocationDate,
    shift: data.shift,
    notes: data.notes,
  }).returning('*');
  const alloc = Array.isArray(allocRows) ? allocRows[0] : allocRows;
  return alloc;
}

export async function removeHrAllocation(id) {
  return db('production.hr_allocations').where({ id }).delete();
}

// ─── Cost summary per Work Order ──────────────────────────────────────────────

export async function getWorkOrderCost(id) {
  const wo = await db('production.work_orders').where({ id }).first();
  if (!wo) return null;
  const [ops, hr] = await Promise.all([
    db('production.work_order_operations').where({ work_order_id: id }),
    db('production.hr_allocations').where({ work_order_id: id }),
  ]);

  const machineCosts = ops.map(op => ({
    sequence: op.sequence, operationName: op.operation_name,
    machineName: op.machine_name, plannedHours: Number(op.planned_hours) || 0,
    actualHours: Number(op.actual_hours) || 0,
    hourlyRate: Number(op.hourly_rate_eur) || 0,
    plannedCost: Number(op.planned_cost_eur) || 0,
    actualCost: Number(op.actual_cost_eur) || 0,
  }));

  const laborCosts = hr.map(h => ({
    userName: h.user_name, role: h.role_at_time,
    allocatedHours: Number(h.allocated_hours) || 0,
    actualHours: Number(h.actual_hours) || 0,
    hourlyRate: Number(h.hourly_rate_eur) || 0,
    plannedCost: Number(h.planned_cost_eur) || 0,
    actualCost: Number(h.actual_cost_eur) || 0,
  }));

  const totalMachinePlanned = machineCosts.reduce((s, c) => s + c.plannedCost, 0);
  const totalLaborPlanned = laborCosts.reduce((s, c) => s + c.plannedCost, 0);
  const totalPlanned = totalMachinePlanned + totalLaborPlanned;
  const totalActual = machineCosts.reduce((s, c) => s + c.actualCost, 0) + laborCosts.reduce((s, c) => s + c.actualCost, 0);
  const costPerPiece = wo.quantity > 0 ? totalPlanned / wo.quantity : 0;

  return {
    workOrder: { id: wo.id, number: wo.work_order_number, productName: wo.product_name, quantity: wo.quantity },
    machineCosts, laborCosts,
    summary: { totalMachinePlanned, totalLaborPlanned, totalPlanned, totalActual, costPerPiece },
  };
}

// ─── HR Cost Rates ────────────────────────────────────────────────────────────

export async function listHrRates() {
  return db('auth.user_cost_rates as ucr')
    .leftJoin('auth.users as u', 'ucr.user_id', 'u.id')
    .select('ucr.*', 'u.full_name as user_name')
    .orderBy('ucr.valid_from', 'desc');
}

export async function createHrRate(data) {
  const hourlyRate = Number(data.hourlyRateEur || data.hourlyRate);
  if (!hourlyRate || isNaN(hourlyRate) || hourlyRate <= 0) {
    throw Object.assign(new Error('Tariful orar este obligatoriu si trebuie sa fie un numar pozitiv.'), { status: 400 });
  }
  const rows = await db('auth.user_cost_rates').insert({
    user_id: data.userId || null,
    role: data.role,
    hourly_rate_eur: hourlyRate,
    overhead_factor: data.overheadFactor || 1.0,
    valid_from: data.validFrom || new Date(),
    valid_to: data.validTo || null,
    notes: data.notes || null,
  }).returning('*');
  const rate = Array.isArray(rows) ? rows[0] : rows;
  return rate;
}
