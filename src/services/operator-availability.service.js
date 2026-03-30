import db from '../config/db.js';

/**
 * Get operators available for a machine on a given date and shift.
 * Conditions:
 * 1. Has skill for the machine (unsupervised capable)
 * 2. Is working that shift on that date (from pattern + overrides)
 * 3. NOT in approved leave on that date
 * 4. NOT already assigned to max_simultaneous_machines other machines on that shift+date
 */
export async function getAvailableOperators(machineId, date, shift) {
  // 1. Operators with skill on this machine
  const skilled = await db('auth.operator_skills as os')
    .join('auth.skill_level_definitions as sld', 'os.skill_level_id', 'sld.id')
    .join('auth.users as u', 'os.user_id', 'u.id')
    .where({ 'os.machine_id': machineId, 'u.is_active': true, 'sld.can_work_unsupervised': true })
    .select('os.user_id', 'u.full_name', 'u.role', 'os.max_simultaneous_machines', 'sld.name as skill_level');

  if (!skilled.length) return [];

  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay(); // 1=Mon..7=Sun

  const result = [];
  for (const op of skilled) {
    // 2a. Check override
    const override = await db('auth.operator_shift_overrides')
      .where({ user_id: op.user_id, date })
      .first();
    if (override) {
      if (!override.shift || override.shift !== shift) continue; // not working or different shift
    } else {
      // 2b. Check pattern
      const pattern = await db('auth.operator_shift_patterns')
        .where({ user_id: op.user_id, shift, is_active: true })
        .where('valid_from', '<=', date)
        .where(q => q.whereNull('valid_to').orWhere('valid_to', '>=', date))
        .first();
      if (!pattern) continue;
      if (!pattern.work_days.includes(dayOfWeek)) continue;
    }

    // 3. Not on approved leave
    const onLeave = await db('auth.leave_requests')
      .where({ user_id: op.user_id, status: 'approved' })
      .where('start_date', '<=', date)
      .where('end_date', '>=', date)
      .first();
    if (onLeave) continue;

    // 4. Check simultaneous machines (from planning allocations on same date+shift)
    const currentlyAssigned = await db('planning.daily_allocations')
      .where({ operator_id: op.user_id, shift })
      .where('date', date)
      .count('* as cnt')
      .first();
    const assigned = Number(currentlyAssigned?.cnt || 0);
    if (assigned >= op.max_simultaneous_machines) continue;

    result.push({ ...op, currently_assigned_machines: assigned });
  }

  return result;
}
