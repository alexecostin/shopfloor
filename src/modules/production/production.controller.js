import * as service from './production.service.js';
import { sendNotification } from '../../services/email.service.js';
import db from '../../config/db.js';

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };

export const listOrders = wrap(async (req, res) => {
  const { status, machineId, page, limit } = req.query;
  res.json(await service.listOrders({ status, machineId, page: +page || 1, limit: +limit || 50 }));
});

export const getOrder = wrap(async (req, res) => {
  res.json(await service.getOrder(req.params.id));
});

export const createOrder = wrap(async (req, res) => {
  res.status(201).json(await service.createOrder(req.body));
});

export const updateOrder = wrap(async (req, res) => {
  res.json(await service.updateOrder(req.params.id, req.body));
});

export const listReports = wrap(async (req, res) => {
  const { machineId, operatorId, shift, dateFrom, dateTo, page, limit } = req.query;
  res.json(await service.listReports({ machineId, operatorId, shift, dateFrom, dateTo, page: +page || 1, limit: +limit || 50 }));
});

export const createReport = wrap(async (req, res) => {
  res.status(201).json(await service.createReport(req.body, req.user.userId));
});

export const listStops = wrap(async (req, res) => {
  const { machineId, shift, open, page, limit } = req.query;
  res.json(await service.listStops({ machineId, shift, open: open === 'true' ? true : open === 'false' ? false : undefined, page: +page || 1, limit: +limit || 50 }));
});

export const createStop = wrap(async (req, res) => {
  const stop = await service.createStop(req.body, req.user.userId);
  res.status(201).json(stop);
  const machine = await db('machines.machines').where({ id: stop.machine_id }).first().catch(() => null);
  sendNotification({ type: 'machine_stop', data: { machineCode: machine?.code || '?', reason: stop.reason, category: stop.category } }).catch(() => {});
});

export const closeStop = wrap(async (req, res) => {
  res.json(await service.closeStop(req.params.id, req.body));
});

export const listShifts = wrap(async (req, res) => {
  const { date, status, page, limit } = req.query;
  res.json(await service.listShifts({ date, status, page: +page || 1, limit: +limit || 20 }));
});

export const createShift = wrap(async (req, res) => {
  res.status(201).json(await service.createShift(req.body, req.user.userId));
});

export const closeShift = wrap(async (req, res) => {
  res.json(await service.closeShift(req.params.id, req.body));
});

export const getDashboard = wrap(async (req, res) => {
  const { date, shift } = req.query;
  res.json(await service.getDashboard({ date, shift }));
});
