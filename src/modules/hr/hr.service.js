import db from '../../config/db.js';

// Skill Levels
export const listSkillLevels = () => db('auth.skill_level_definitions').orderBy('rank');
export const createSkillLevel = async data => {
  const [r] = await db('auth.skill_level_definitions').insert(data).returning('*');
  return r;
};
export const updateSkillLevel = async (id, data) => {
  const [r] = await db('auth.skill_level_definitions').where('id', id).update(data).returning('*');
  return r;
};

// Operator Skills
export const listSkills = ({ userId, machineId } = {}) => {
  let q = db('auth.operator_skills as os')
    .join('auth.skill_level_definitions as sld', 'os.skill_level_id', 'sld.id')
    .join('auth.users as u', 'os.user_id', 'u.id')
    .join('machines.machines as m', 'os.machine_id', 'm.id')
    .select('os.*', 'sld.name as skill_level_name', 'sld.rank', 'sld.color', 'sld.can_work_unsupervised', 'u.full_name', 'm.code as machine_code', 'm.name as machine_name');
  if (userId) q = q.where('os.user_id', userId);
  if (machineId) q = q.where('os.machine_id', machineId);
  return q;
};

export const getSkillMatrix = async () => {
  const skills = await db('auth.operator_skills as os')
    .join('auth.skill_level_definitions as sld', 'os.skill_level_id', 'sld.id')
    .join('auth.users as u', 'os.user_id', 'u.id')
    .join('machines.machines as m', 'os.machine_id', 'm.id')
    .select('os.user_id', 'u.full_name', 'os.machine_id', 'm.code as machine_code', 'm.name as machine_name', 'sld.name as skill_level', 'sld.rank', 'sld.color', 'os.max_simultaneous_machines');

  const map = {};
  for (const s of skills) {
    if (!map[s.user_id]) map[s.user_id] = { user_id: s.user_id, full_name: s.full_name, machines: [] };
    map[s.user_id].machines.push({ machine_id: s.machine_id, machine_code: s.machine_code, machine_name: s.machine_name, skill_level: s.skill_level, rank: s.rank, color: s.color, max_simultaneous_machines: s.max_simultaneous_machines });
  }
  return Object.values(map);
};

export const createSkill = async data => {
  const [r] = await db('auth.operator_skills').insert(data).returning('*');
  return r;
};
export const updateSkill = async (id, data) => {
  const [r] = await db('auth.operator_skills').where('id', id).update({ ...data, updated_at: new Date() }).returning('*');
  return r;
};
export const deleteSkill = async id => db('auth.operator_skills').where('id', id).delete();

// Shift Patterns
export const listShiftPatterns = ({ userId } = {}) => {
  let q = db('auth.operator_shift_patterns');
  if (userId) q = q.where('user_id', userId);
  return q.orderBy('valid_from', 'desc');
};
export const createShiftPattern = async data => {
  const [r] = await db('auth.operator_shift_patterns').insert(data).returning('*');
  return r;
};
export const updateShiftPattern = async (id, data) => {
  const [r] = await db('auth.operator_shift_patterns').where('id', id).update(data).returning('*');
  return r;
};
export const createShiftOverride = async data => {
  const [r] = await db('auth.operator_shift_overrides').insert(data).onConflict(['user_id', 'date']).merge().returning('*');
  return r;
};

export const getShiftSchedule = async ({ dateFrom, dateTo }) => {
  const users = await db('auth.users').where('is_active', true).whereIn('role', ['operator', 'shift_leader']);
  const patterns = await db('auth.operator_shift_patterns').where('is_active', true);
  const overrides = await db('auth.operator_shift_overrides').whereBetween('date', [dateFrom, dateTo]);

  const schedule = [];
  const days = [];
  let cur = new Date(dateFrom);
  const end = new Date(dateTo);
  while (cur <= end) { days.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }

  for (const user of users) {
    const userPatterns = patterns.filter(p => p.user_id === user.id);
    const userOverrides = overrides.filter(o => o.user_id === user.id);
    const daySchedule = [];
    for (const day of days) {
      const ov = userOverrides.find(o => o.date === day || o.date?.toISOString?.().split('T')[0] === day);
      if (ov) { daySchedule.push({ date: day, shift: ov.shift, source: 'override' }); continue; }
      const d = new Date(day);
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      const pat = userPatterns.find(p => p.valid_from <= day && (!p.valid_to || p.valid_to >= day) && p.work_days.includes(dow));
      daySchedule.push({ date: day, shift: pat?.shift || null, source: pat ? 'pattern' : 'none' });
    }
    schedule.push({ user_id: user.id, full_name: user.full_name, schedule: daySchedule });
  }
  return schedule;
};

// Leave Requests
export const listLeaveRequests = ({ status, userId } = {}) => {
  let q = db('auth.leave_requests as lr')
    .join('auth.users as u', 'lr.user_id', 'u.id')
    .select('lr.*', 'u.full_name')
    .orderBy('lr.created_at', 'desc');
  if (status) q = q.where('lr.status', status);
  if (userId) q = q.where('lr.user_id', userId);
  return q;
};

export const createLeaveRequest = async (data, userId) => {
  // Validate no overlapping approved leave
  const overlap = await db('auth.leave_requests')
    .where({ user_id: userId, status: 'approved' })
    .where('start_date', '<=', data.end_date)
    .where('end_date', '>=', data.start_date)
    .first();
  if (overlap) throw Object.assign(new Error('Exista deja un concediu aprobat in aceasta perioada.'), { statusCode: 409 });

  const [r] = await db('auth.leave_requests').insert({ ...data, user_id: userId }).returning('*');
  return r;
};

export const approveLeaveRequest = async (id, reviewerId) => {
  const req = await db('auth.leave_requests').where('id', id).first();
  if (!req) return null;

  // Check if operator is planned in those days
  const allocations = await db('planning.daily_allocations')
    .where({ operator_id: req.user_id })
    .whereBetween('date', [req.start_date, req.end_date]);

  const [r] = await db('auth.leave_requests').where('id', id)
    .update({ status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date() })
    .returning('*');

  return { leave: r, warning: allocations.length > 0 ? `Operatorul este planificat in ${allocations.length} ture in aceasta perioada!` : null };
};

export const rejectLeaveRequest = async (id, reviewerId, reviewer_notes) => {
  const [r] = await db('auth.leave_requests').where('id', id)
    .update({ status: 'rejected', reviewed_by: reviewerId, reviewed_at: new Date(), reviewer_notes })
    .returning('*');
  return r;
};

export const getLeaveCalendar = async ({ dateFrom, dateTo }) => {
  return db('auth.leave_requests as lr')
    .join('auth.users as u', 'lr.user_id', 'u.id')
    .select('lr.*', 'u.full_name')
    .where('status', 'approved')
    .where('start_date', '<=', dateTo)
    .where('end_date', '>=', dateFrom)
    .orderBy('lr.start_date');
};
