import * as service from './planned.service.js';

const wrap = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

export const listPlanned = wrap(async (req, res) => {
  const { machineId, status, dateFrom, dateTo, page, limit } = req.query;
  res.json(await service.listPlanned(
    { machineId, status, dateFrom, dateTo, page: +page || 1, limit: +limit || 50 },
    req
  ));
});

export const getPlanned = wrap(async (req, res) => {
  res.json(await service.getPlanned(req.params.id));
});

export const createPlanned = wrap(async (req, res) => {
  const intervention = await service.createPlanned(req.body, req.user.userId, req);
  res.status(201).json(intervention);
});

export const confirmPlanned = wrap(async (req, res) => {
  res.json(await service.confirmPlanned(req.params.id, req.user.userId));
});

export const startPlanned = wrap(async (req, res) => {
  res.json(await service.startPlanned(req.params.id));
});

export const completePlanned = wrap(async (req, res) => {
  res.json(await service.completePlanned(req.params.id, req.body, req.user.userId));
});

export const listSchedules = wrap(async (req, res) => {
  res.json(await service.listSchedules(req.params.machineId));
});

export const createSchedule = wrap(async (req, res) => {
  const schedule = await service.createSchedule(req.params.machineId, req.body, req.user.userId);
  res.status(201).json(schedule);
});

export const updateSchedule = wrap(async (req, res) => {
  res.json(await service.updateSchedule(req.params.id, req.body));
});

export const deleteSchedule = wrap(async (req, res) => {
  await service.deleteSchedule(req.params.id);
  res.status(204).send();
});
