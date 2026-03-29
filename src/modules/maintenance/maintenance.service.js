import db from '../../config/db.js';

const TABLE = 'maintenance.requests';

function notFound(msg) { const e = new Error(msg); e.statusCode = 404; e.code = 'CERERE_NEGASITA'; return e; }

async function nextRequestNumber() {
  const seq = await db.raw(`SELECT nextval('maintenance.request_number_seq') AS val`);
  const n = String(seq.rows[0].val).padStart(4, '0');
  return `MT-${n}`;
}

export async function listRequests({ status, machineId, assignedTo, priority, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  let q = db(TABLE);
  if (status) q = q.where({ status });
  if (machineId) q = q.where({ machine_id: machineId });
  if (assignedTo) q = q.where({ assigned_to: assignedTo });
  if (priority) q = q.where({ priority });

  const [{ count }] = await q.clone().count('id as count');
  const rows = await q.orderBy('created_at', 'desc').limit(limit).offset(offset);
  return { data: rows, pagination: { page, limit, total: Number(count), pages: Math.ceil(count / limit) } };
}

export async function getRequest(id) {
  const row = await db(TABLE).where({ id }).first();
  if (!row) throw notFound('Cererea de mentenanta nu a fost gasita.');
  return row;
}

export async function createRequest({ machineId, problemType, description, priority, photoUrl }, reportedBy) {
  const requestNumber = await nextRequestNumber();
  const [row] = await db(TABLE).insert({
    request_number: requestNumber,
    machine_id: machineId,
    reported_by: reportedBy,
    problem_type: problemType,
    description: description || null,
    priority: priority || 'normal',
    photo_url: photoUrl || null,
    status: 'open',
  }).returning('*');
  return row;
}

export async function updateRequest(id, { assignedTo, priority, status, resolution }) {
  await getRequest(id);
  const updates = {};
  if (assignedTo !== undefined) updates.assigned_to = assignedTo;
  if (priority !== undefined) updates.priority = priority;
  if (status !== undefined) {
    updates.status = status;
    if (status === 'in_progress' && !updates.started_at) updates.started_at = new Date();
    if (status === 'done') updates.resolved_at = new Date();
  }
  if (resolution !== undefined) updates.resolution = resolution;

  const [updated] = await db(TABLE).where({ id }).update(updates).returning('*');
  return updated;
}

export async function getDashboard() {
  const [total] = await db(TABLE).count('id as count');
  const byStatus = await db(TABLE).select('status').count('id as count').groupBy('status');
  const byPriority = await db(TABLE).select('priority').count('id as count').groupBy('priority');
  const openCritical = await db(TABLE).where({ status: 'open', priority: 'critical' }).orderBy('created_at', 'asc');

  return {
    total: Number(total.count),
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.count)])),
    byPriority: Object.fromEntries(byPriority.map((r) => [r.priority, Number(r.count)])),
    openCritical,
  };
}
