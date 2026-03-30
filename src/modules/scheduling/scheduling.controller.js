import * as svc from './scheduling.service.js';
import { generateSchedule as runScheduler } from '../../services/scheduler.service.js';

const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

// Configs
export const listConfigs = wrap(async (req, res) => res.json(await svc.listConfigs()));
export const createConfig = wrap(async (req, res) => res.status(201).json(await svc.createConfig(req.body, req.user.userId)));
export const updateConfig = wrap(async (req, res) => {
  const r = await svc.updateConfig(req.params.id, req.body);
  if (!r) return res.status(404).json({ message: 'Config negasita.' });
  res.json(r);
});
export const deleteConfig = wrap(async (req, res) => {
  await svc.deleteConfig(req.params.id);
  res.json({ message: 'Sters.' });
});
export const setDefaultConfig = wrap(async (req, res) => res.json(await svc.setDefaultConfig(req.params.id)));

// Runs
export const listRuns = wrap(async (req, res) => res.json(await svc.listRuns(req.query)));
export const getRun = wrap(async (req, res) => {
  const r = await svc.getRun(req.params.id);
  if (!r) return res.status(404).json({ message: 'Run negasit.' });
  res.json(r);
});
export const deleteRun = wrap(async (req, res) => {
  await svc.deleteRun(req.params.id);
  res.json({ message: 'Sters.' });
});

// Operations
export const getRunOperations = wrap(async (req, res) => res.json(await svc.getRunOperations({ runId: req.params.runId, ...req.query })));
export const getGanttData = wrap(async (req, res) => res.json(await svc.getGanttData({ runId: req.params.runId, ...req.query })));
export const updateOperation = wrap(async (req, res) => {
  const r = await svc.updateOperation(req.params.id, req.body);
  if (!r) return res.status(404).json({ message: 'Operatie negasita.' });
  res.json(r);
});
export const applyRun = wrap(async (req, res) => {
  const r = await svc.applyRun(req.params.id);
  if (!r) return res.status(404).json({ message: 'Run negasit.' });
  res.json(r);
});

export const generateSchedule = wrap(async (req, res) => {
  const { configId, periodStart, periodEnd, name } = req.body;
  if (!periodStart || !periodEnd) return res.status(400).json({ message: 'periodStart si periodEnd sunt obligatorii.' });
  const result = await runScheduler(configId, periodStart, periodEnd, name || `Plan ${new Date().toISOString().split('T')[0]}`, req.user.userId);
  res.status(201).json(result);
});

// Simulations
export const listSimulations = wrap(async (req, res) => res.json(await svc.listSimulations()));
export const createSimulation = wrap(async (req, res) => res.status(201).json(await svc.createSimulation(req.body, req.user.userId)));
export const getSimulation = wrap(async (req, res) => {
  const r = await svc.getSimulation(req.params.id);
  if (!r) return res.status(404).json({ message: 'Simulare negasita.' });
  res.json(r);
});
export const compareSimulation = wrap(async (req, res) => {
  const r = await svc.compareSimulation(req.params.id);
  if (!r) return res.status(404).json({ message: 'Simulare negasita.' });
  res.json(r);
});
export const applySimulation = wrap(async (req, res) => {
  const r = await svc.applySimulation(req.params.id);
  if (!r) return res.status(404).json({ message: 'Simulare negasita.' });
  res.json(r);
});
export const deleteSimulation = wrap(async (req, res) => {
  await svc.deleteSimulation(req.params.id);
  res.json({ message: 'Sters.' });
});
