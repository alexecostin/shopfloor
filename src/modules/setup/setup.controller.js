import db from '../../config/db.js';
import { calculateSetupTime } from '../../services/setup.service.js';

const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

export const getMachineSetup = wrap(async (req, res) => {
  const { machineId } = req.params;
  const [def, overrides, factors] = await Promise.all([
    db('machines.setup_defaults').where('machine_id', machineId).first(),
    db('machines.setup_overrides').where('machine_id', machineId).orderBy('created_at', 'desc'),
    db('machines.setup_factor_values as sfv')
      .join('machines.setup_factor_definitions as sfd', 'sfv.factor_id', 'sfd.id')
      .where('sfv.machine_id', machineId)
      .select('sfv.*', 'sfd.name as factor_name'),
  ]);
  res.json({ default: def || null, overrides, factors });
});

export const setDefault = wrap(async (req, res) => {
  const { machineId } = req.params;
  const { default_minutes, notes } = req.body;
  const existing = await db('machines.setup_defaults').where('machine_id', machineId).first();
  let row;
  if (existing) {
    [row] = await db('machines.setup_defaults').where('machine_id', machineId)
      .update({ default_minutes, notes, updated_at: db.fn.now() }).returning('*');
  } else {
    [row] = await db('machines.setup_defaults').insert({ machine_id: machineId, default_minutes, notes }).returning('*');
  }
  res.json(row);
});

export const listOverrides = wrap(async (req, res) => {
  res.json(await db('machines.setup_overrides').where('machine_id', req.params.machineId).orderBy('created_at', 'desc'));
});

export const createOverride = wrap(async (req, res) => {
  const { machineId } = req.params;
  const [row] = await db('machines.setup_overrides').insert({ machine_id: machineId, ...req.body }).returning('*');
  res.status(201).json(row);
});

export const updateOverride = wrap(async (req, res) => {
  const [row] = await db('machines.setup_overrides').where('id', req.params.id).update(req.body).returning('*');
  if (!row) return res.status(404).json({ message: 'Override negasit.' });
  res.json(row);
});

export const deleteOverride = wrap(async (req, res) => {
  await db('machines.setup_overrides').where('id', req.params.id).delete();
  res.json({ message: 'Sters.' });
});

export const listFactors = wrap(async (req, res) => {
  res.json(await db('machines.setup_factor_definitions').orderBy('sort_order'));
});

export const createFactor = wrap(async (req, res) => {
  const [row] = await db('machines.setup_factor_definitions').insert(req.body).returning('*');
  res.status(201).json(row);
});

export const updateFactor = wrap(async (req, res) => {
  const [row] = await db('machines.setup_factor_definitions').where('id', req.params.id).update(req.body).returning('*');
  if (!row) return res.status(404).json({ message: 'Factor negasit.' });
  res.json(row);
});

export const getFactorValues = wrap(async (req, res) => {
  const { machineId, productId } = req.params;
  const vals = await db('machines.setup_factor_values as sfv')
    .join('machines.setup_factor_definitions as sfd', 'sfv.factor_id', 'sfd.id')
    .where({ 'sfv.machine_id': machineId, 'sfv.product_id': productId })
    .select('sfv.*', 'sfd.name as factor_name');
  res.json(vals);
});

export const setFactorValues = wrap(async (req, res) => {
  const { machineId, productId } = req.params;
  // req.body = [{factor_id, minutes}]
  const values = req.body.map(v => ({ factor_id: v.factor_id, machine_id: machineId, product_id: productId, minutes: v.minutes, updated_at: new Date() }));
  await db('machines.setup_factor_values')
    .where({ machine_id: machineId, product_id: productId })
    .delete();
  if (values.length > 0) await db('machines.setup_factor_values').insert(values);
  res.json({ saved: values.length });
});

export const calculate = wrap(async (req, res) => {
  const { machineId, fromProductId, toProductId } = req.query;
  if (!machineId || !toProductId) return res.status(400).json({ message: 'machineId si toProductId sunt obligatorii.' });
  const result = await calculateSetupTime(machineId, fromProductId || null, toProductId);
  res.json(result);
});
