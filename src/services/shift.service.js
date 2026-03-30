import db from '../config/db.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = String(timeStr).substring(0, 5).split(':').map(Number);
  return h * 60 + (m || 0);
}

function isCurrentlyInShift(shift, nowMinutes) {
  const start = timeToMinutes(shift.start_time);
  const end = timeToMinutes(shift.end_time);
  if (!shift.crosses_midnight) {
    return nowMinutes >= start && nowMinutes < end;
  }
  // crosses midnight: active from start→00:00 OR 00:00→end next day
  return nowMinutes >= start || nowMinutes < end;
}

function formatShift(d) {
  return {
    id: d.id,
    shiftCode: d.shift_code,
    shiftName: d.shift_name,
    startTime: String(d.start_time).substring(0, 5),
    endTime: String(d.end_time).substring(0, 5),
    crossesMidnight: d.crosses_midnight,
    breakMinutes: d.break_minutes,
    productiveMinutes: d.productive_minutes,
    sortOrder: d.sort_order,
  };
}

// JS getDay(): 0=Sun,1=Mon,...,6=Sat  → schema: 0=Mon,...,5=Sat,6=Sun
function jsDayToSchema(jsDay) {
  return jsDay === 0 ? 6 : jsDay - 1;
}

// ─── resolve which org_unit level has shift definitions ────────────────────────

async function resolveOrgUnitForShifts(orgUnitId) {
  let id = orgUnitId;
  const visited = new Set();
  while (id && !visited.has(id)) {
    visited.add(id);
    const [{ n }] = await db('shifts.shift_definitions')
      .where({ org_unit_id: id, is_active: true })
      .count('id as n');
    if (Number(n) > 0) return id;
    const parent = await db('org.units').where({ id }).select('parent_id').first();
    id = parent?.parent_id || null;
  }
  return null;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export async function getShiftDefinitions(orgUnitId) {
  const resolvedId = await resolveOrgUnitForShifts(orgUnitId);
  if (!resolvedId) return [];
  return db('shifts.shift_definitions')
    .where({ org_unit_id: resolvedId, is_active: true })
    .orderBy('sort_order');
}

export async function getActiveShiftsForDate(orgUnitId, date) {
  const resolvedId = await resolveOrgUnitForShifts(orgUnitId);
  if (!resolvedId) return [];

  const definitions = await db('shifts.shift_definitions')
    .where({ org_unit_id: resolvedId, is_active: true })
    .orderBy('sort_order');

  if (!definitions.length) return [];

  const defByCode = Object.fromEntries(definitions.map(d => [d.shift_code, d]));

  // Check for exception (exact date OR recurring MM-DD match)
  const dateObj = new Date(date);
  const monthDay = `${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

  const exception = await db('shifts.schedule_exceptions')
    .where({ org_unit_id: resolvedId })
    .where(function () {
      this.where('exception_date', date).orWhere(function () {
        this.where('is_recurring', true).whereRaw("TO_CHAR(exception_date, 'MM-DD') = ?", [monthDay]);
      });
    })
    .orderBy('is_recurring', 'asc') // exact date first
    .first();

  if (exception) {
    const activeCodes = exception.active_shifts || [];
    if (!activeCodes.length) return []; // closed
    return activeCodes
      .map((code) => {
        const def = defByCode[code];
        if (!def) return null;
        const override = (exception.override_times || []).find((o) => o.shiftCode === code);
        return formatShift(override ? { ...def, start_time: override.startTime, end_time: override.endTime } : def);
      })
      .filter(Boolean);
  }

  // Normal weekly schedule
  const dayOfWeek = jsDayToSchema(dateObj.getDay());
  const weeklyEntries = await db('shifts.weekly_schedule as ws')
    .join('shifts.shift_definitions as sd', 'ws.shift_definition_id', 'sd.id')
    .where('ws.org_unit_id', resolvedId)
    .where('ws.day_of_week', dayOfWeek)
    .where('ws.is_active', true)
    .where('sd.is_active', true)
    .select('sd.*')
    .orderBy('sd.sort_order');

  return weeklyEntries.map(formatShift);
}

export async function getCurrentShift(orgUnitId) {
  if (!orgUnitId) return null;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Get today's active shifts
  const todayShifts = await getActiveShiftsForDate(orgUnitId, today);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Check today's non-crossing-midnight shifts
  for (const shift of todayShifts) {
    if (!shift.crossesMidnight && isCurrentlyInShift(shift, nowMinutes)) {
      return shift;
    }
  }

  // Check today's crosses-midnight shifts (covers start→midnight portion)
  for (const shift of todayShifts) {
    if (shift.crossesMidnight) {
      const start = timeToMinutes(shift.startTime);
      if (nowMinutes >= start) return shift; // we're in the "today" portion
    }
  }

  // Check yesterday's crosses-midnight shifts (covers midnight→end portion)
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const yesterdayShifts = await getActiveShiftsForDate(orgUnitId, yesterdayStr);

  for (const shift of yesterdayShifts) {
    if (shift.crossesMidnight) {
      const end = timeToMinutes(shift.endTime);
      if (nowMinutes < end) return shift; // we're in the "tomorrow" portion of yesterday's T3
    }
  }

  return null; // outside working hours
}

export async function getAvailableHours(machineId, date) {
  // Get machine's org_unit_id
  const machine = await db('machines.machines').where({ id: machineId }).select('org_unit_id').first();
  const orgUnitId = machine?.org_unit_id;

  if (!orgUnitId) {
    // No org_unit configured — return sensible default
    return { totalHours: 16, shifts: [], maintenanceHours: 0 };
  }

  const shifts = await getActiveShiftsForDate(orgUnitId, date);
  const totalMinutes = shifts.reduce((s, sh) => s + (sh.productiveMinutes || 450), 0);
  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

  // Subtract planned maintenance hours
  const maintRows = await db('maintenance.planned_interventions')
    .where({ machine_id: machineId, status: 'confirmed' })
    .where('planned_start_date', '<=', date)
    .where('planned_end_date', '>=', date)
    .select('planned_start_date', 'planned_end_date', 'estimated_duration_hours')
    .catch(() => []);

  let maintenanceHours = 0;
  for (const m of maintRows) {
    maintenanceHours += Number(m.estimated_duration_hours) || 0;
  }

  return {
    totalHours: Math.max(0, totalHours - maintenanceHours),
    shifts,
    maintenanceHours,
  };
}

export async function isWorkingDay(orgUnitId, date) {
  const shifts = await getActiveShiftsForDate(orgUnitId, date);
  return shifts.length > 0;
}

export async function getWorkingDaysBetween(orgUnitId, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (await isWorkingDay(orgUnitId, dateStr)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export async function getCalendar(orgUnitId, month, year) {
  const days = [];
  const daysInMonth = new Date(year, month, 0).getDate(); // month is 1-based
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(dateStr);
    const dayOfWeek = jsDayToSchema(dateObj.getDay());

    const shifts = await getActiveShiftsForDate(orgUnitId, dateStr);
    const totalMinutes = shifts.reduce((s, sh) => s + (sh.productiveMinutes || 0), 0);

    // Check for exception marker
    const resolvedId = await resolveOrgUnitForShifts(orgUnitId);
    const monthDay = `${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const exception = resolvedId
      ? await db('shifts.schedule_exceptions')
          .where({ org_unit_id: resolvedId })
          .where(function () {
            this.where('exception_date', dateStr).orWhere(function () {
              this.where('is_recurring', true).whereRaw("TO_CHAR(exception_date, 'MM-DD') = ?", [monthDay]);
            });
          })
          .first()
      : null;

    days.push({
      date: dateStr,
      dayOfWeek,
      isWorkingDay: shifts.length > 0,
      isException: !!exception,
      exceptionName: exception?.name || null,
      exceptionType: exception?.exception_type || null,
      shifts,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    });
  }
  return days;
}

export async function getWeeklySchedule(orgUnitId) {
  const resolvedId = await resolveOrgUnitForShifts(orgUnitId);
  if (!resolvedId) return [];

  const dayNames = ['Luni', 'Marti', 'Miercuri', 'Joi', 'Vineri', 'Sambata', 'Duminica'];
  const result = [];

  for (let day = 0; day <= 6; day++) {
    const entries = await db('shifts.weekly_schedule as ws')
      .join('shifts.shift_definitions as sd', 'ws.shift_definition_id', 'sd.id')
      .where('ws.org_unit_id', resolvedId)
      .where('ws.day_of_week', day)
      .where('ws.is_active', true)
      .where('sd.is_active', true)
      .select('sd.*', 'ws.id as ws_id')
      .orderBy('sd.sort_order');

    result.push({
      dayOfWeek: day,
      dayName: dayNames[day],
      shifts: entries.map(formatShift),
    });
  }
  return result;
}
