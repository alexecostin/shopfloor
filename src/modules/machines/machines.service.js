import db from '../../config/db.js';

const TABLE = 'machines.machines';
const OPERATORS_TABLE = 'machines.machine_operators';

export async function listMachines({ status, type, search, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  let query = db(TABLE);

  if (status) query = query.where({ status });
  if (type) query = query.where({ type });
  if (search) {
    query = query.where((q) =>
      q.whereILike('name', `%${search}%`).orWhereILike('code', `%${search}%`)
    );
  }

  const [{ count }] = await query.clone().count('id as count');
  const machines = await query.orderBy('code', 'asc').limit(limit).offset(offset);

  return {
    data: machines,
    pagination: { page, limit, total: Number(count), pages: Math.ceil(count / limit) },
  };
}

export async function getMachine(id) {
  const machine = await db(TABLE).where({ id }).first();
  if (!machine) {
    const err = new Error('Utilajul nu a fost gasit.');
    err.statusCode = 404;
    err.code = 'UTILAJ_NEGASIT';
    throw err;
  }

  const operators = await db(OPERATORS_TABLE).where({ machine_id: id });
  return { ...machine, operators };
}

export async function createMachine({ code, name, type, location, status, metadata }) {
  const existing = await db(TABLE).where({ code }).first();
  if (existing) {
    const err = new Error(`Exista deja un utilaj cu codul "${code}".`);
    err.statusCode = 409;
    err.code = 'COD_DUPLICAT';
    throw err;
  }

  const [machine] = await db(TABLE)
    .insert({ code, name, type, location: location || null, status: status || 'active', metadata: metadata || {} })
    .returning('*');

  return machine;
}

export async function updateMachine(id, { name, type, location, status, metadata }) {
  const machine = await db(TABLE).where({ id }).first();
  if (!machine) {
    const err = new Error('Utilajul nu a fost gasit.');
    err.statusCode = 404;
    err.code = 'UTILAJ_NEGASIT';
    throw err;
  }

  const updates = { updated_at: new Date() };
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (location !== undefined) updates.location = location;
  if (status !== undefined) updates.status = status;
  if (metadata !== undefined) updates.metadata = metadata;

  const [updated] = await db(TABLE).where({ id }).update(updates).returning('*');
  return updated;
}

export async function deleteMachine(id) {
  const machine = await db(TABLE).where({ id }).first();
  if (!machine) {
    const err = new Error('Utilajul nu a fost gasit.');
    err.statusCode = 404;
    err.code = 'UTILAJ_NEGASIT';
    throw err;
  }

  await db(TABLE).where({ id }).del();
}

export async function assignOperator(machineId, userId) {
  await getMachine(machineId);

  const existing = await db(OPERATORS_TABLE).where({ machine_id: machineId, user_id: userId }).first();
  if (existing) {
    const err = new Error('Operatorul este deja asignat acestui utilaj.');
    err.statusCode = 409;
    err.code = 'OPERATOR_DEJA_ASIGNAT';
    throw err;
  }

  await db(OPERATORS_TABLE).insert({ machine_id: machineId, user_id: userId });
}

export async function removeOperator(machineId, userId) {
  await getMachine(machineId);
  await db(OPERATORS_TABLE).where({ machine_id: machineId, user_id: userId }).del();
}
