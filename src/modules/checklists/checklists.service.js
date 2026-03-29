import db from '../../config/db.js';

function notFound(msg) { const e = new Error(msg); e.statusCode = 404; e.code = 'TEMPLATE_NEGASIT'; return e; }

export async function listTemplates({ machineType, isActive } = {}) {
  let q = db('checklists.templates');
  if (machineType) q = q.where({ machine_type: machineType });
  if (isActive !== undefined) q = q.where({ is_active: isActive });
  return q.orderBy('name', 'asc');
}

export async function getTemplate(id) {
  const t = await db('checklists.templates').where({ id }).first();
  if (!t) throw notFound('Template-ul nu a fost gasit.');
  return t;
}

export async function createTemplate({ name, machineType, items }) {
  const [t] = await db('checklists.templates').insert({
    name,
    machine_type: machineType || null,
    items: JSON.stringify(items),
  }).returning('*');
  return t;
}

export async function updateTemplate(id, { name, machineType, items, isActive }) {
  await getTemplate(id);
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (machineType !== undefined) updates.machine_type = machineType;
  if (items !== undefined) updates.items = JSON.stringify(items);
  if (isActive !== undefined) updates.is_active = isActive;

  const [updated] = await db('checklists.templates').where({ id }).update(updates).returning('*');
  return updated;
}

export async function completeChecklist({ templateId, machineId, shift, responses }, operatorId) {
  await getTemplate(templateId);

  const template = await db('checklists.templates').where({ id: templateId }).first();
  const requiredItems = (template.items || []).filter((i) => i.required);
  const allOk = requiredItems.every((item) => {
    const resp = responses.find((r) => r.itemId === item.id);
    return resp && resp.checked;
  });

  const [completion] = await db('checklists.completions').insert({
    template_id: templateId,
    machine_id: machineId,
    operator_id: operatorId,
    shift: shift || null,
    responses: JSON.stringify(responses),
    all_ok: allOk,
  }).returning('*');
  return completion;
}

export async function listCompletions({ machineId, operatorId, templateId, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  let q = db('checklists.completions');
  if (machineId) q = q.where({ machine_id: machineId });
  if (operatorId) q = q.where({ operator_id: operatorId });
  if (templateId) q = q.where({ template_id: templateId });

  const [{ count }] = await q.clone().count('id as count');
  const rows = await q.orderBy('completed_at', 'desc').limit(limit).offset(offset);
  return { data: rows, pagination: { page, limit, total: Number(count), pages: Math.ceil(count / limit) } };
}
