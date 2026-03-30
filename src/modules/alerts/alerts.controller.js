import * as svc from './alerts.service.js';

const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

export const listRules = wrap(async (req, res) => res.json(await svc.listRules()));
export const createRule = wrap(async (req, res) => res.status(201).json(await svc.createRule(req.body)));
export const updateRule = wrap(async (req, res) => {
  const r = await svc.updateRule(req.params.id, req.body);
  if (!r) return res.status(404).json({ message: 'Regula negasita.' });
  res.json(r);
});
export const deleteRule = wrap(async (req, res) => {
  await svc.deleteRule(req.params.id);
  res.json({ message: 'Sters.' });
});

export const listChannels = wrap(async (req, res) => res.json(await svc.listChannels(req.params.ruleId)));
export const createChannel = wrap(async (req, res) => res.status(201).json(await svc.createChannel(req.params.ruleId, req.body)));
export const deleteChannel = wrap(async (req, res) => {
  await svc.deleteChannel(req.params.id);
  res.json({ message: 'Sters.' });
});

export const listAlerts = wrap(async (req, res) => res.json(await svc.listAlerts(req.query)));
export const getAlertCount = wrap(async (req, res) => res.json(await svc.getAlertCount()));
export const acknowledgeAlert = wrap(async (req, res) => {
  const r = await svc.acknowledgeAlert(req.params.id, req.user.userId);
  if (!r) return res.status(404).json({ message: 'Alerta negasita.' });
  res.json(r);
});
export const resolveAlert = wrap(async (req, res) => {
  const r = await svc.resolveAlert(req.params.id, req.user.userId);
  if (!r) return res.status(404).json({ message: 'Alerta negasita.' });
  res.json(r);
});
export const triggerCheck = wrap(async (req, res) => {
  const result = await svc.runCheck();
  res.json(result);
});
