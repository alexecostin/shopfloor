import * as service from './maintenance.service.js';

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

export const list = wrap(async (req, res) => {
  const { status, machineId, assignedTo, priority, page, limit } = req.query;
  res.json(await service.listRequests({ status, machineId, assignedTo, priority, page: +page || 1, limit: +limit || 50 }));
});

export const get = wrap(async (req, res) => res.json(await service.getRequest(req.params.id)));

export const create = wrap(async (req, res) => {
  res.status(201).json(await service.createRequest(req.body, req.user.userId));
});

export const update = wrap(async (req, res) => {
  res.json(await service.updateRequest(req.params.id, req.body));
});

export const dashboard = wrap(async (req, res) => res.json(await service.getDashboard()));
