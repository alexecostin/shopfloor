import * as svc from './tools.service.js';

const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

export const list = wrap(async (req, res) => res.json(await svc.listTools(req.query)));
export const get = wrap(async (req, res) => {
  const r = await svc.getTool(req.params.id);
  if (!r) return res.status(404).json({ message: 'Scula negasita.' });
  res.json(r);
});
export const create = wrap(async (req, res) => res.status(201).json(await svc.createTool(req.body)));
export const update = wrap(async (req, res) => {
  const r = await svc.updateTool(req.params.id, req.body);
  if (!r) return res.status(404).json({ message: 'Scula negasita.' });
  res.json(r);
});
export const retire = wrap(async (req, res) => {
  const r = await svc.retireTool(req.params.id);
  if (!r) return res.status(404).json({ message: 'Scula negasita.' });
  res.json(r);
});
export const assign = wrap(async (req, res) => {
  const r = await svc.assignTool(req.params.id, req.body.machineId || null, req.user.userId, req.body.notes);
  if (!r) return res.status(404).json({ message: 'Scula negasita.' });
  res.json(r);
});
export const updateCycles = wrap(async (req, res) => {
  const r = await svc.updateCycles(req.params.id, req.body);
  if (!r) return res.status(404).json({ message: 'Scula negasita.' });
  res.json(r);
});
export const addMaintenance = wrap(async (req, res) => {
  const r = await svc.addMaintenance(req.params.id, req.body, req.user.userId);
  if (!r) return res.status(404).json({ message: 'Scula negasita.' });
  res.status(201).json(r);
});
export const consumablesStatus = wrap(async (req, res) => res.json(await svc.getConsumablesStatus()));
