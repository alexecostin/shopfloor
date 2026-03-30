import * as svc from './reports.service.js';

const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

export const prrByProduct = wrap(async (req, res) => {
  const { dateFrom, dateTo, productId } = req.query;
  if (!dateFrom || !dateTo) return res.status(400).json({ message: 'dateFrom si dateTo sunt obligatorii.' });
  res.json(await svc.getByProduct({ dateFrom, dateTo, productId }));
});

export const prrByMachine = wrap(async (req, res) => {
  res.json(await svc.getByMachine(req.query));
});

export const prrByOrder = wrap(async (req, res) => {
  const r = await svc.getByOrder(req.params.orderId);
  if (!r) return res.status(404).json({ message: 'Comanda negasita.' });
  res.json(r);
});

export const prrByOperator = wrap(async (req, res) => {
  const { dateFrom, dateTo, userId } = req.query;
  if (!dateFrom || !dateTo) return res.status(400).json({ message: 'dateFrom si dateTo sunt obligatorii.' });
  res.json(await svc.getByOperator({ dateFrom, dateTo, userId }));
});

export const weeklySummary = wrap(async (req, res) => {
  const { weekStart } = req.query;
  if (!weekStart) return res.status(400).json({ message: 'weekStart este obligatoriu.' });
  res.json(await svc.getWeeklySummary(weekStart));
});

export const trend = wrap(async (req, res) => {
  const { productId, machineId, weeks } = req.query;
  res.json(await svc.getTrend({ productId, machineId, weeks: weeks ? parseInt(weeks) : 8 }));
});

export const monthComparison = wrap(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ message: 'month si year sunt obligatorii.' });
  res.json(await svc.getMonthComparison({ month, year }));
});

export const listSaved = wrap(async (req, res) => {
  res.json(await svc.listSavedReports());
});

export const createSaved = wrap(async (req, res) => {
  const r = await svc.createSavedReport(req.body, req.user.userId);
  res.status(201).json(r);
});

export const deleteSaved = wrap(async (req, res) => {
  const ok = await svc.deleteSavedReport(req.params.id);
  if (!ok) return res.status(404).json({ message: 'Raport salvat negasit.' });
  res.json({ message: 'Sters.' });
});
