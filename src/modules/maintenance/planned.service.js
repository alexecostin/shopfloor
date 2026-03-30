import db from '../../config/db.js';
import { applyScopeFilter } from '../../middleware/scopeFilter.js';

const TABLE = 'maintenance.planned_interventions';

function notFound(msg) {
  const e = new Error(msg);
  e.statusCode = 404;
  e.code = 'INTERVENTIE_NEGASITA';
  return e;
}

function extractTenant(req) {
  return {
    tenant_id: req?.tenantFilter?.tenantId || null,
    org_unit_id: req?.user?.scopes?.[0]?.orgUnitId || null,
  };
}

function getDaysBetween(start, end) {
  const days = [];
  const cursor = new Date(start);
  const endDate = new Date(end);
  while (cursor <= endDate) {
    days.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function calculateNextDueDate(recurrenceRule, completedAt) {
  if (!recurrenceRule) return null;
  const base = new Date(completedAt);
  const type = recurrenceRule.type;

  if (type === 'months') {
    const months = recurrenceRule.interval_months || 1;
    const next = new Date(base);
    next.setMonth(next.getMonth() + months);
    return next.toISOString().split('T')[0];
  }
  if (type === 'days') {
    const days = recurrenceRule.interval_days || 1;
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    return next.toISOString().split('T')[0];
  }
  if (type === 'hours') return null;
  if (type === 'cycles') return null;
  return null;
}

// ─── PLANNED INTERVENTIONS ────────────────────────────────────────────────────

export async function listPlanned({ machineId, status, dateFrom, dateTo, page = 1, limit = 50 } = {}, req = null) {
  const offset = (page - 1) * limit;
  let q = db(TABLE);
  applyScopeFilter(q, req);
  if (machineId) q = q.where({ machine_id: machineId });
  if (status) q = q.where({ status });
  if (dateFrom) q = q.where('planned_start_date', '>=', dateFrom);
  if (dateTo) q = q.where('planned_end_date', '<=', dateTo);

  const [{ count }] = await q.clone().count('id as count');
  const rows = await q.orderBy('planned_start_date', 'asc').limit(limit).offset(offset);
  return { data: rows, pagination: { page, limit, total: Number(count), pages: Math.ceil(Number(count) / limit) } };
}

export async function getPlanned(id) {
  const row = await db(TABLE + ' as pi')
    .leftJoin('machines.machines as m', 'pi.machine_id', 'm.id')
    .where('pi.id', id)
    .select('pi.*', 'm.name as machine_name', 'm.code as machine_code')
    .first();
  if (!row) throw notFound('Interventia planificata nu a fost gasita.');
  return row;
}

export async function createPlanned(data, userId, req = null) {
  const {
    machineId,
    interventionType,
    title,
    description,
    plannedStartDate,
    plannedEndDate,
    plannedDurationHours,
    executorType,
    executorCompanyId,
    executorContactId,
    internalTeamNotes,
    estimatedCost,
    costNotes,
    isRecurring,
    recurrenceRule,
    nextDueDate,
  } = data;

  if (!machineId) { const e = new Error('machineId este obligatoriu.'); e.statusCode = 400; throw e; }
  if (!title) { const e = new Error('title este obligatoriu.'); e.statusCode = 400; throw e; }
  if (!plannedStartDate) { const e = new Error('plannedStartDate este obligatoriu.'); e.statusCode = 400; throw e; }
  if (!plannedEndDate) { const e = new Error('plannedEndDate este obligatoriu.'); e.statusCode = 400; throw e; }
  if (!executorType) { const e = new Error('executorType este obligatoriu.'); e.statusCode = 400; throw e; }

  const [row] = await db(TABLE).insert({
    machine_id: machineId,
    intervention_type: interventionType || 'preventive',
    title,
    description: description || null,
    planned_start_date: plannedStartDate,
    planned_end_date: plannedEndDate,
    planned_duration_hours: plannedDurationHours || null,
    executor_type: executorType,
    executor_company_id: executorCompanyId || null,
    executor_contact_id: executorContactId || null,
    internal_team_notes: internalTeamNotes || null,
    estimated_cost: estimatedCost || null,
    cost_notes: costNotes || null,
    is_recurring: isRecurring || false,
    recurrence_rule: recurrenceRule ? JSON.stringify(recurrenceRule) : null,
    next_due_date: nextDueDate || null,
    created_by: userId,
    ...extractTenant(req),
  }).returning('*');
  return row;
}

export async function confirmPlanned(id, userId) {
  const intervention = await getPlanned(id);
  if (intervention.status !== 'planned') {
    const e = new Error('Interventia trebuie sa fie in status "planned" pentru a fi confirmata.');
    e.statusCode = 400;
    throw e;
  }

  const [updated] = await db(TABLE).where({ id }).update({
    status: 'confirmed',
    confirmed_at: new Date(),
    confirmed_by: userId,
  }).returning('*');

  // Block machine in planning capacity for each day in the planned period
  const days = getDaysBetween(intervention.planned_start_date, intervention.planned_end_date);
  for (const day of days) {
    await db('planning.capacity_load').insert({
      machine_id: intervention.machine_id,
      plan_date: day,
      shift: 'all',
      available_hours: 0,
      notes: `Mentenanta planificata: ${intervention.title}`,
    }).onConflict(['machine_id', 'plan_date', 'shift']).merge().catch(() => {});
  }

  return updated;
}

export async function startPlanned(id) {
  const intervention = await getPlanned(id);
  if (intervention.status !== 'confirmed') {
    const e = new Error('Interventia trebuie sa fie in status "confirmed" pentru a putea fi pornita.');
    e.statusCode = 400;
    throw e;
  }

  const [updated] = await db(TABLE).where({ id }).update({
    status: 'in_progress',
    started_at: new Date(),
  }).returning('*');
  return updated;
}

export async function completePlanned(id, data, userId) {
  const intervention = await getPlanned(id);
  if (!['confirmed', 'in_progress'].includes(intervention.status)) {
    const e = new Error('Interventia trebuie sa fie in status "confirmed" sau "in_progress" pentru a fi finalizata.');
    e.statusCode = 400;
    throw e;
  }

  const { actualCost, completionNotes, partsUsed = [] } = data;

  const completedAt = new Date();

  const [updated] = await db(TABLE).where({ id }).update({
    status: 'completed',
    actual_cost: actualCost || null,
    completion_notes: completionNotes || null,
    parts_used: JSON.stringify(partsUsed),
    completed_at: completedAt,
    completed_by: userId,
  }).returning('*');

  // For each part used: create inventory movement (reduce stock)
  for (const part of partsUsed) {
    if (!part.item_id || !part.quantity) continue;
    await db('inventory.movements').insert({
      item_id: part.item_id,
      movement_type: 'production_input',
      quantity: -Math.abs(part.quantity),
      reference_type: 'maintenance',
      reference_id: id,
      notes: `Mentenanta planificata: ${intervention.title}`,
      created_by: userId,
    }).catch(() => {});
  }

  // If recurring: calculate next_due_date and create next planned intervention
  if (intervention.is_recurring && intervention.recurrence_rule) {
    const recurrenceRule = typeof intervention.recurrence_rule === 'string'
      ? JSON.parse(intervention.recurrence_rule)
      : intervention.recurrence_rule;

    const nextDueDate = calculateNextDueDate(recurrenceRule, completedAt);

    if (nextDueDate) {
      // Estimate end date: same duration as original
      const origStart = new Date(intervention.planned_start_date);
      const origEnd = new Date(intervention.planned_end_date);
      const durationDays = Math.round((origEnd - origStart) / 86400000);
      const nextEndDate = new Date(nextDueDate);
      nextEndDate.setDate(nextEndDate.getDate() + durationDays);

      await db(TABLE).insert({
        machine_id: intervention.machine_id,
        tenant_id: intervention.tenant_id,
        org_unit_id: intervention.org_unit_id,
        intervention_type: intervention.intervention_type,
        title: intervention.title,
        description: intervention.description,
        planned_start_date: nextDueDate,
        planned_end_date: nextEndDate.toISOString().split('T')[0],
        planned_duration_hours: intervention.planned_duration_hours,
        executor_type: intervention.executor_type,
        executor_company_id: intervention.executor_company_id,
        executor_contact_id: intervention.executor_contact_id,
        internal_team_notes: intervention.internal_team_notes,
        estimated_cost: intervention.estimated_cost,
        is_recurring: true,
        recurrence_rule: intervention.recurrence_rule,
        next_due_date: nextDueDate,
        created_by: userId,
        status: 'planned',
      }).catch(() => {});

      // Update this intervention's next_due_date
      await db(TABLE).where({ id }).update({ next_due_date: nextDueDate }).catch(() => {});
    }
  }

  // Update maintenance_schedule last_performed_at if linked
  await db('machines.maintenance_schedules')
    .where({ machine_id: intervention.machine_id, is_active: true })
    .update({
      last_performed_at: completedAt,
    }).catch(() => {});

  return updated;
}

// ─── MAINTENANCE SCHEDULES ────────────────────────────────────────────────────

export async function listSchedules(machineId) {
  return db('machines.maintenance_schedules')
    .where({ machine_id: machineId })
    .orderBy('created_at', 'asc');
}

export async function createSchedule(machineId, data, userId) {
  const {
    scheduleName,
    triggerType,
    intervalHours,
    intervalMonths,
    intervalCycles,
    nextDueDate,
    nextDueHours,
    nextDueCycles,
    autoCreateIntervention,
    isActive,
  } = data;

  const [row] = await db('machines.maintenance_schedules').insert({
    machine_id: machineId,
    schedule_name: scheduleName,
    trigger_type: triggerType,
    interval_hours: intervalHours || null,
    interval_months: intervalMonths || null,
    interval_cycles: intervalCycles || null,
    next_due_date: nextDueDate || null,
    next_due_hours: nextDueHours || null,
    next_due_cycles: nextDueCycles || null,
    auto_create_intervention: autoCreateIntervention !== undefined ? autoCreateIntervention : true,
    is_active: isActive !== undefined ? isActive : true,
  }).returning('*');
  return row;
}

export async function updateSchedule(id, data) {
  const {
    scheduleName,
    triggerType,
    intervalHours,
    intervalMonths,
    intervalCycles,
    lastPerformedAt,
    lastPerformedHours,
    lastPerformedCycles,
    nextDueDate,
    nextDueHours,
    nextDueCycles,
    autoCreateIntervention,
    isActive,
  } = data;

  const updates = {};
  if (scheduleName !== undefined) updates.schedule_name = scheduleName;
  if (triggerType !== undefined) updates.trigger_type = triggerType;
  if (intervalHours !== undefined) updates.interval_hours = intervalHours;
  if (intervalMonths !== undefined) updates.interval_months = intervalMonths;
  if (intervalCycles !== undefined) updates.interval_cycles = intervalCycles;
  if (lastPerformedAt !== undefined) updates.last_performed_at = lastPerformedAt;
  if (lastPerformedHours !== undefined) updates.last_performed_hours = lastPerformedHours;
  if (lastPerformedCycles !== undefined) updates.last_performed_cycles = lastPerformedCycles;
  if (nextDueDate !== undefined) updates.next_due_date = nextDueDate;
  if (nextDueHours !== undefined) updates.next_due_hours = nextDueHours;
  if (nextDueCycles !== undefined) updates.next_due_cycles = nextDueCycles;
  if (autoCreateIntervention !== undefined) updates.auto_create_intervention = autoCreateIntervention;
  if (isActive !== undefined) updates.is_active = isActive;

  const [updated] = await db('machines.maintenance_schedules').where({ id }).update(updates).returning('*');
  if (!updated) {
    const e = new Error('Programul de mentenanta nu a fost gasit.');
    e.statusCode = 404;
    throw e;
  }
  return updated;
}

export async function deleteSchedule(id) {
  const deleted = await db('machines.maintenance_schedules').where({ id }).del();
  if (!deleted) {
    const e = new Error('Programul de mentenanta nu a fost gasit.');
    e.statusCode = 404;
    throw e;
  }
}
