import * as service from '../../services/shift.service.js';
import db from '../../config/db.js';

const wrap = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

// ── Definitions ───────────────────────────────────────────────────────────────

export const listDefinitions = wrap(async (req, res) => {
  const { orgUnitId } = req.query;
  const defs = await service.getShiftDefinitions(orgUnitId || req.user?.scopes?.[0]?.orgUnitId);
  res.json(defs);
});

export const createDefinition = wrap(async (req, res) => {
  const [def] = await db('shifts.shift_definitions').insert({
    org_unit_id: req.body.orgUnitId,
    tenant_id: req.tenantFilter?.tenantId || null,
    shift_name: req.body.shiftName,
    shift_code: req.body.shiftCode,
    start_time: req.body.startTime,
    end_time: req.body.endTime,
    crosses_midnight: req.body.crossesMidnight ?? (req.body.endTime < req.body.startTime),
    break_minutes: req.body.breakMinutes ?? 30,
    sort_order: req.body.sortOrder ?? 1,
  }).returning('*');
  res.status(201).json(def);
});

export const updateDefinition = wrap(async (req, res) => {
  const updates = {};
  const b = req.body;
  if (b.shiftName !== undefined) updates.shift_name = b.shiftName;
  if (b.startTime !== undefined) updates.start_time = b.startTime;
  if (b.endTime !== undefined) updates.end_time = b.endTime;
  if (b.crossesMidnight !== undefined) updates.crosses_midnight = b.crossesMidnight;
  if (b.breakMinutes !== undefined) updates.break_minutes = b.breakMinutes;
  if (b.sortOrder !== undefined) updates.sort_order = b.sortOrder;
  if (b.isActive !== undefined) updates.is_active = b.isActive;
  const [def] = await db('shifts.shift_definitions').where({ id: req.params.id }).update(updates).returning('*');
  res.json(def);
});

export const deleteDefinition = wrap(async (req, res) => {
  await db('shifts.shift_definitions').where({ id: req.params.id }).delete();
  res.status(204).end();
});

// ── Weekly Schedule ───────────────────────────────────────────────────────────

export const getWeekly = wrap(async (req, res) => {
  const orgUnitId = req.query.orgUnitId || req.user?.scopes?.[0]?.orgUnitId;
  res.json(await service.getWeeklySchedule(orgUnitId));
});

export const upsertWeekly = wrap(async (req, res) => {
  const { orgUnitId, schedule } = req.body;

  // Get all definitions for this org_unit
  const defs = await db('shifts.shift_definitions').where({ org_unit_id: orgUnitId, is_active: true });
  const defByCode = Object.fromEntries(defs.map(d => [d.shift_code, d]));

  // Delete existing and recreate
  await db('shifts.weekly_schedule').where({ org_unit_id: orgUnitId }).delete();

  const rows = [];
  for (const { dayOfWeek, shiftCodes } of schedule) {
    for (const code of shiftCodes) {
      const def = defByCode[code];
      if (!def) continue;
      rows.push({
        org_unit_id: orgUnitId,
        tenant_id: req.tenantFilter?.tenantId || null,
        day_of_week: dayOfWeek,
        shift_definition_id: def.id,
      });
    }
  }
  if (rows.length) await db('shifts.weekly_schedule').insert(rows);

  res.json(await service.getWeeklySchedule(orgUnitId));
});

// ── Exceptions ────────────────────────────────────────────────────────────────

export const listExceptions = wrap(async (req, res) => {
  const { orgUnitId, year } = req.query;
  let q = db('shifts.schedule_exceptions').where({ org_unit_id: orgUnitId });
  if (year) q = q.whereRaw('EXTRACT(YEAR FROM exception_date) = ? OR is_recurring = true', [year]);
  res.json(await q.orderBy('exception_date'));
});

export const createException = wrap(async (req, res) => {
  const [exc] = await db('shifts.schedule_exceptions').insert({
    org_unit_id: req.body.orgUnitId,
    tenant_id: req.tenantFilter?.tenantId || null,
    exception_date: req.body.exceptionDate,
    exception_type: req.body.exceptionType,
    name: req.body.name || null,
    active_shifts: JSON.stringify(req.body.activeShifts || []),
    override_times: req.body.overrideTimes ? JSON.stringify(req.body.overrideTimes) : null,
    is_recurring: req.body.isRecurring || false,
    created_by: req.user.userId,
  }).returning('*');
  res.status(201).json(exc);
});

export const updateException = wrap(async (req, res) => {
  const updates = {};
  const b = req.body;
  if (b.name !== undefined) updates.name = b.name;
  if (b.exceptionType !== undefined) updates.exception_type = b.exceptionType;
  if (b.activeShifts !== undefined) updates.active_shifts = JSON.stringify(b.activeShifts);
  if (b.overrideTimes !== undefined) updates.override_times = b.overrideTimes ? JSON.stringify(b.overrideTimes) : null;
  if (b.isRecurring !== undefined) updates.is_recurring = b.isRecurring;
  const [exc] = await db('shifts.schedule_exceptions').where({ id: req.params.id }).update(updates).returning('*');
  res.json(exc);
});

export const deleteException = wrap(async (req, res) => {
  await db('shifts.schedule_exceptions').where({ id: req.params.id }).delete();
  res.status(204).end();
});

// ── Calendar ──────────────────────────────────────────────────────────────────

export const getCalendar = wrap(async (req, res) => {
  const { orgUnitId, month, year } = req.query;
  const resolvedOrgUnit = orgUnitId || req.user?.scopes?.[0]?.orgUnitId;
  res.json(await service.getCalendar(resolvedOrgUnit, Number(month) || new Date().getMonth() + 1, Number(year) || new Date().getFullYear()));
});

// ── Utility ───────────────────────────────────────────────────────────────────

export const getCurrentShift = wrap(async (req, res) => {
  const orgUnitId = req.query.orgUnitId || req.user?.scopes?.[0]?.orgUnitId;
  res.json(await service.getCurrentShift(orgUnitId));
});

export const getAvailableHours = wrap(async (req, res) => {
  const { machineId, date } = req.query;
  res.json(await service.getAvailableHours(machineId, date || new Date().toISOString().slice(0, 10)));
});
