import * as svc from './workorders.service.js';
import { logBusinessAction } from '../../services/audit.service.js';

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
const tid = req => req.user?.tenantId || req.tenantFilter?.tenantId;

export const listWorkOrders = wrap(async (req, res) => {
  res.json(await svc.listWorkOrders(req.query));
});

export const getWorkOrder = wrap(async (req, res) => {
  const wo = await svc.getWorkOrder(req.params.id);
  if (!wo) return res.status(404).json({ message: 'Comanda de lucru negasita.' });
  res.json(wo);
});

export const createWorkOrder = wrap(async (req, res) => {
  const wo = await svc.createWorkOrder(req.body, req.user.userId);
  res.status(201).json(wo);
  logBusinessAction(req, 'workorder.created', 'work_order', wo.id, wo.wo_number || wo.id, 'Work order created');
});

export const updateWorkOrder = wrap(async (req, res) => {
  const wo = await svc.updateWorkOrder(req.params.id, req.body, tid(req));
  if (!wo) return res.status(404).json({ message: 'Comanda de lucru negasita.' });
  res.json(wo);
});

export const updateOperation = wrap(async (req, res) => {
  const op = await svc.updateOperation(req.params.id, req.body);
  if (!op) return res.status(404).json({ message: 'Operatie negasita.' });
  res.json(op);
});

export const addHrAllocation = wrap(async (req, res) => {
  const alloc = await svc.addHrAllocation(req.params.id, req.body);
  res.status(201).json(alloc);
});

export const removeHrAllocation = wrap(async (req, res) => {
  await svc.removeHrAllocation(req.params.id);
  res.json({ message: 'Sters.' });
});

export const getWorkOrderCost = wrap(async (req, res) => {
  const cost = await svc.getWorkOrderCost(req.params.id);
  if (!cost) return res.status(404).json({ message: 'Comanda de lucru negasita.' });
  res.json(cost);
});

export const listHrRates = wrap(async (req, res) => {
  res.json(await svc.listHrRates());
});

export const createHrRate = wrap(async (req, res) => {
  const rate = await svc.createHrRate(req.body);
  res.status(201).json(rate);
});

export const listStatuses = wrap(async (req, res) => {
  res.json(await svc.getAllStatuses(tid(req)));
});

export const getNextStatuses = wrap(async (req, res) => {
  res.json(await svc.getNextStatuses(tid(req), req.params.id));
});

export const changeStatus = wrap(async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ message: 'Status lipsa' });
  res.json(await svc.changeStatus(tid(req), req.params.id, status));
});

// ─── Technical Checks ────────────────────────────────────────────────────────

export const getTechnicalChecks = wrap(async (req, res) => {
  const checks = await svc.getTechnicalChecks(req.params.id);
  res.json(checks);
});

export const updateTechnicalCheck = wrap(async (req, res) => {
  const check = await svc.updateTechnicalCheck(req.params.checkId, {
    isPassed: req.body.isPassed,
    notes: req.body.notes,
    userId: req.user.userId,
  });
  if (!check) return res.status(404).json({ message: 'Verificare negasita.' });
  res.json(check);
});

// ─── Material Status ─────────────────────────────────────────────────────────

export const getMaterialStatus = wrap(async (req, res) => {
  const materials = await svc.getMaterialStatus(req.params.id);
  res.json(materials);
});

// ─── Launch to Production ────────────────────────────────────────────────────

export const launchToProduction = wrap(async (req, res) => {
  const wo = await svc.launchToProduction(req.params.id, req.user.userId);
  if (!wo) return res.status(404).json({ message: 'Comanda negasita.' });
  res.json(wo);
  logBusinessAction(req, 'workorder.launched', 'work_order', wo.id, wo.work_order_number || wo.id, 'Work order launched to production');
});
