import db from '../../config/db.js';
import { applyScopeFilter } from '../../middleware/scopeFilter.js';
import { replanForMachineDowntime, replanForMachineRestored } from '../../services/replan.service.js';

const TABLE = 'maintenance.requests';

function notFound(msg) { const e = new Error(msg); e.statusCode = 404; e.code = 'CERERE_NEGASITA'; return e; }

function extractTenant(req) {
  return {
    tenant_id: req?.tenantFilter?.tenantId || null,
    org_unit_id: req?.user?.scopes?.[0]?.orgUnitId || null,
  };
}

async function nextRequestNumber() {
  const seq = await db.raw(`SELECT nextval('maintenance.request_number_seq') AS val`);
  const n = String(seq.rows[0].val).padStart(4, '0');
  return `MT-${n}`;
}

export async function listRequests({ status, machineId, assignedTo, priority, page = 1, limit = 50 } = {}, req = null) {
  const offset = (page - 1) * limit;
  let q = db(TABLE);
  applyScopeFilter(q, req);
  if (status) q = q.where({ status });
  if (machineId) q = q.where({ machine_id: machineId });
  if (assignedTo) q = q.where({ assigned_to: assignedTo });
  if (priority) q = q.where({ priority });

  const [{ count }] = await q.clone().count(`${TABLE}.id as count`);
  const rows = await q.clone()
    .leftJoin('auth.users as reporter', `${TABLE}.reported_by`, 'reporter.id')
    .leftJoin('auth.users as assignee', `${TABLE}.assigned_to`, 'assignee.id')
    .leftJoin('machines.machines as m', `${TABLE}.machine_id`, 'm.id')
    .select(
      `${TABLE}.*`,
      'reporter.full_name as reported_by_name',
      'assignee.full_name as assigned_to_name',
      'm.code as machine_code',
      'm.name as machine_name',
    )
    .orderBy(`${TABLE}.created_at`, 'desc').limit(limit).offset(offset);
  return { data: rows, pagination: { page, limit, total: Number(count), pages: Math.ceil(count / limit) } };
}

export async function getRequest(id) {
  const row = await db(TABLE)
    .leftJoin('auth.users as reporter', `${TABLE}.reported_by`, 'reporter.id')
    .leftJoin('auth.users as assignee', `${TABLE}.assigned_to`, 'assignee.id')
    .leftJoin('machines.machines as m', `${TABLE}.machine_id`, 'm.id')
    .where(`${TABLE}.id`, id)
    .select(
      `${TABLE}.*`,
      'reporter.full_name as reported_by_name',
      'assignee.full_name as assigned_to_name',
      'm.code as machine_code',
      'm.name as machine_name',
    )
    .first();
  if (!row) throw notFound('Cererea de mentenanta nu a fost gasita.');
  return row;
}

export async function createRequest({ machineId, problemType, description, priority, photoUrl }, reportedBy, req = null) {
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
    ...extractTenant(req),
  }).returning('*');
  return row;
}

export async function updateRequest(id, { assignedTo, priority, status, resolution, estimatedHours }, userId = null) {
  const existing = await db(TABLE).where({ id }).first();
  if (!existing) throw notFound('Cererea de mentenanta nu a fost gasita.');

  const updates = {};
  if (assignedTo !== undefined) updates.assigned_to = assignedTo;
  if (priority !== undefined) updates.priority = priority;
  if (resolution !== undefined) updates.resolution = resolution;

  let replanResult = null;

  if (status !== undefined) {
    updates.status = status;

    if (status === 'in_progress' && existing.status !== 'in_progress') {
      updates.started_at = new Date();
      if (assignedTo) updates.assigned_to = assignedTo;

      // Machine is now blocked — trigger automatic replan
      try {
        const hours = estimatedHours || 8;
        const startDate = new Date().toISOString().split('T')[0];
        const endMs = Date.now() + hours * 3600000;
        const endDate = new Date(endMs).toISOString().split('T')[0];
        const machine = await db('machines.machines').where('id', existing.machine_id).first();

        replanResult = await replanForMachineDowntime(
          existing.machine_id,
          startDate,
          endDate === startDate ? startDate : endDate,
          `Cerere mentenanta ${existing.request_number}: ${existing.problem_type}`,
          userId || assignedTo
        );

        // Update machine status
        await db('machines.machines').where('id', existing.machine_id)
          .update({ status: 'maintenance' }).catch(() => {});
      } catch (e) {
        // Replan is best-effort — don't block the status update
        replanResult = { error: e.message };
      }
    }

    if (status === 'done') {
      updates.resolved_at = new Date();
      // Restore machine status
      await db('machines.machines').where('id', existing.machine_id)
        .update({ status: 'active' }).catch(() => {});

      // Trigger reverse replan — move production back to this machine
      try {
        replanResult = await replanForMachineRestored(
          existing.machine_id,
          userId || existing.assigned_to
        );
      } catch (e) {
        replanResult = { error: e.message };
      }
    }
  }

  const [updated] = await db(TABLE).where({ id }).update(updates).returning('*');

  // Re-fetch with joins
  const full = await getRequest(id);
  return { ...full, replanResult };
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
