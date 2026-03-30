import * as svc from './planning.service.js';
import * as replanSvc from '../../services/replan.service.js';

export const getMasterPlans = async (req, res, next) => {
  try { res.json(await svc.listMasterPlans(req.query)); } catch (e) { next(e); }
};

export const getMasterPlanById = async (req, res, next) => {
  try {
    const p = await svc.getMasterPlan(req.params.id);
    if (!p) return res.status(404).json({ message: 'Plan negasit.' });
    res.json(p);
  } catch (e) { next(e); }
};

export const postMasterPlan = async (req, res, next) => {
  try {
    const p = await svc.createMasterPlan(req.body, req.user.id);
    res.status(201).json(p);
  } catch (e) { next(e); }
};

export const putMasterPlan = async (req, res, next) => {
  try {
    const p = await svc.updateMasterPlan(req.params.id, req.body);
    if (!p) return res.status(404).json({ message: 'Plan negasit.' });
    res.json(p);
  } catch (e) { next(e); }
};

export const getAllocations = async (req, res, next) => {
  try { res.json(await svc.listAllocations(req.query)); } catch (e) { next(e); }
};

export const postAllocation = async (req, res, next) => {
  try {
    const a = await svc.createAllocation(req.body);
    res.status(201).json(a);
  } catch (e) { next(e); }
};

export const postBulkAllocations = async (req, res, next) => {
  try {
    const result = await svc.bulkCreateAllocations(req.body.masterPlanId, req.body.allocations);
    res.status(201).json({ inserted: result.length, data: result });
  } catch (e) { next(e); }
};

export const putAllocation = async (req, res, next) => {
  try {
    const a = await svc.updateAllocation(req.params.id, req.body);
    if (!a) return res.status(404).json({ message: 'Alocare negasita.' });
    res.json(a);
  } catch (e) { next(e); }
};

export const deleteAllocation = async (req, res, next) => {
  try {
    await svc.deleteAllocation(req.params.id);
    res.json({ message: 'Sters.' });
  } catch (e) { next(e); }
};

export const getCapacity = async (req, res, next) => {
  try { res.json(await svc.listCapacity(req.query)); } catch (e) { next(e); }
};

export const getDemands = async (req, res, next) => {
  try { res.json(await svc.listDemands(req.query)); } catch (e) { next(e); }
};

export const postDemand = async (req, res, next) => {
  try {
    const d = await svc.createDemand(req.body);
    res.status(201).json(d);
  } catch (e) { next(e); }
};

export const postBulkDemands = async (req, res, next) => {
  try {
    const result = await svc.bulkCreateDemands(req.body.demands);
    res.status(201).json({ inserted: result.length, data: result });
  } catch (e) { next(e); }
};

export const getDashboard = async (req, res, next) => {
  try {
    const weekStart = req.query.weekStart || new Date().toISOString().split('T')[0];
    res.json(await svc.getDashboard(weekStart));
  } catch (e) { next(e); }
};

export const approveReplan = async (req, res, next) => {
  try { res.json(await replanSvc.approveReplan(req.params.id, req.user.userId)); } catch (e) { next(e); }
};

export const rejectReplan = async (req, res, next) => {
  try { res.json(await replanSvc.rejectReplan(req.params.id, req.user.userId, req.body.reason)); } catch (e) { next(e); }
};
