import db from '../../config/db.js';

export async function listTools({ type, trackingMode, status, machineId, page = 1, limit = 50 }) {
  let q = db('machines.tools as t')
    .leftJoin('machines.machines as m', 't.current_machine_id', 'm.id')
    .select('t.*', 'm.code as machine_code', 'm.name as machine_name');
  if (type) q = q.where('t.type', type);
  if (trackingMode) q = q.where('t.tracking_mode', trackingMode);
  if (status) q = q.where('t.status', status);
  if (machineId) q = q.where('t.current_machine_id', machineId);
  q = q.orderBy('t.code').limit(limit).offset((page - 1) * limit);
  return q;
}

export async function getTool(id) {
  const tool = await db('machines.tools as t')
    .leftJoin('machines.machines as m', 't.current_machine_id', 'm.id')
    .select('t.*', 'm.code as machine_code', 'm.name as machine_name')
    .where('t.id', id).first();
  if (!tool) return null;
  const [maintenance_log, assignments_log] = await Promise.all([
    db('machines.tool_maintenance_log').where('tool_id', id).orderBy('performed_at', 'desc'),
    db('machines.tool_assignments_log as tal')
      .leftJoin('machines.machines as mf', 'tal.from_machine_id', 'mf.id')
      .leftJoin('machines.machines as mt', 'tal.to_machine_id', 'mt.id')
      .select('tal.*', 'mf.code as from_machine_code', 'mt.code as to_machine_code')
      .where('tal.tool_id', id).orderBy('tal.assigned_at', 'desc'),
  ]);
  return { ...tool, maintenance_log, assignments_log };
}

export async function createTool(data) {
  const [r] = await db('machines.tools').insert(data).returning('*');
  return r;
}

export async function updateTool(id, data) {
  const [r] = await db('machines.tools').where('id', id).update({ ...data, updated_at: new Date() }).returning('*');
  return r;
}

export async function retireTool(id) {
  const [r] = await db('machines.tools').where('id', id).update({ status: 'retired', updated_at: new Date() }).returning('*');
  return r;
}

export async function assignTool(toolId, machineId, assignedBy, notes) {
  const tool = await db('machines.tools').where('id', toolId).first();
  if (!tool) return null;
  await db('machines.tool_assignments_log').insert({
    tool_id: toolId,
    from_machine_id: tool.current_machine_id || null,
    to_machine_id: machineId || null,
    assigned_by: assignedBy,
    notes,
  });
  const [r] = await db('machines.tools').where('id', toolId)
    .update({ current_machine_id: machineId || null, updated_at: new Date() })
    .returning('*');
  return r;
}

export async function updateCycles(id, { cycles, hours }) {
  const updates = { updated_at: new Date() };
  if (cycles !== undefined) updates.current_cycles = cycles;
  if (hours !== undefined) updates.current_hours = hours;
  const [r] = await db('machines.tools').where('id', id).update(updates).returning('*');
  return r;
}

export async function addMaintenance(toolId, data, performedBy) {
  const tool = await db('machines.tools').where('id', toolId).first();
  if (!tool) return null;

  let next_maintenance_due = null;
  if (tool.maintenance_interval_cycles && data.maintenance_type === 'preventive') {
    next_maintenance_due = null; // Will be recalculated when cycles reach interval
  }

  const [log] = await db('machines.tool_maintenance_log').insert({
    tool_id: toolId,
    ...data,
    performed_by: performedBy,
    cycles_at_maintenance: tool.current_cycles,
    hours_at_maintenance: tool.current_hours,
    next_maintenance_due,
  }).returning('*');

  // Reset cycles if preventive
  if (data.maintenance_type === 'preventive') {
    await db('machines.tools').where('id', toolId).update({
      current_cycles: 0,
      current_hours: 0,
      next_maintenance_due,
      status: 'active',
      updated_at: new Date(),
    });
  }

  return log;
}

export async function incrementToolCycles(machineId, pieces) {
  const tools = await db('machines.tools')
    .where({ current_machine_id: machineId, tracking_mode: 'tracked', status: 'active' });

  for (const tool of tools) {
    const newCycles = (tool.current_cycles || 0) + pieces;
    const updates = { current_cycles: newCycles, updated_at: new Date() };

    // Check if approaching maintenance
    if (tool.maintenance_interval_cycles) {
      const threshold = tool.maintenance_interval_cycles * 0.9;
      if (newCycles >= threshold) {
        // Log warning (in production would trigger an alert)
        console.warn(`Tool ${tool.code} approaching maintenance: ${newCycles}/${tool.maintenance_interval_cycles} cycles`);
      }
    }
    await db('machines.tools').where('id', tool.id).update(updates);
  }
}

export async function getConsumablesStatus() {
  const consumables = await db('machines.tools as t')
    .leftJoin('machines.machines as m', 't.current_machine_id', 'm.id')
    .where('t.tracking_mode', 'consumable')
    .where('t.status', '!=', 'retired')
    .select('t.*', 'm.code as machine_code');
  return consumables.map(c => ({
    ...c,
    // estimated days remaining based on consumption_per_hour (simplified)
    days_remaining: c.consumption_per_hour && c.consumption_per_hour > 0
      ? Math.floor(c.current_hours / c.consumption_per_hour / 8)  // assuming 8h/day
      : null,
  }));
}
