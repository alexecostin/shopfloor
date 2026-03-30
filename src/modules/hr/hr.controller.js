import * as svc from './hr.service.js';
import { getAvailableOperators } from '../../services/operator-availability.service.js';

const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

export const listSkillLevels = wrap(async (req, res) => res.json(await svc.listSkillLevels()));
export const createSkillLevel = wrap(async (req, res) => res.status(201).json(await svc.createSkillLevel(req.body)));
export const updateSkillLevel = wrap(async (req, res) => {
  const r = await svc.updateSkillLevel(req.params.id, req.body);
  if (!r) return res.status(404).json({ message: 'Nivel negasit.' });
  res.json(r);
});

export const listSkills = wrap(async (req, res) => res.json(await svc.listSkills(req.query)));
export const getSkillMatrix = wrap(async (req, res) => res.json(await svc.getSkillMatrix()));
export const createSkill = wrap(async (req, res) => res.status(201).json(await svc.createSkill(req.body)));
export const updateSkill = wrap(async (req, res) => {
  const r = await svc.updateSkill(req.params.id, req.body);
  if (!r) return res.status(404).json({ message: 'Skill negasit.' });
  res.json(r);
});
export const deleteSkill = wrap(async (req, res) => {
  await svc.deleteSkill(req.params.id);
  res.json({ message: 'Sters.' });
});

export const listShiftPatterns = wrap(async (req, res) => res.json(await svc.listShiftPatterns(req.query)));
export const createShiftPattern = wrap(async (req, res) => res.status(201).json(await svc.createShiftPattern(req.body)));
export const updateShiftPattern = wrap(async (req, res) => {
  const r = await svc.updateShiftPattern(req.params.id, req.body);
  if (!r) return res.status(404).json({ message: 'Pattern negasit.' });
  res.json(r);
});
export const getShiftSchedule = wrap(async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  if (!dateFrom || !dateTo) return res.status(400).json({ message: 'dateFrom si dateTo sunt obligatorii.' });
  res.json(await svc.getShiftSchedule({ dateFrom, dateTo }));
});
export const createShiftOverride = wrap(async (req, res) => res.status(201).json(await svc.createShiftOverride(req.body)));

export const listLeave = wrap(async (req, res) => res.json(await svc.listLeaveRequests(req.query)));
export const createLeave = wrap(async (req, res) => {
  const r = await svc.createLeaveRequest(req.body, req.user.userId);
  res.status(201).json(r);
});
export const approveLeave = wrap(async (req, res) => {
  const r = await svc.approveLeaveRequest(req.params.id, req.user.userId);
  if (!r) return res.status(404).json({ message: 'Cerere negasita.' });
  res.json(r);
});
export const rejectLeave = wrap(async (req, res) => {
  const r = await svc.rejectLeaveRequest(req.params.id, req.user.userId, req.body.reviewer_notes);
  if (!r) return res.status(404).json({ message: 'Cerere negasita.' });
  res.json(r);
});
export const getLeaveCalendar = wrap(async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  if (!dateFrom || !dateTo) return res.status(400).json({ message: 'dateFrom si dateTo sunt obligatorii.' });
  res.json(await svc.getLeaveCalendar({ dateFrom, dateTo }));
});

export const getAvailable = wrap(async (req, res) => {
  const { machineId, date, shift } = req.query;
  if (!machineId || !date || !shift) return res.status(400).json({ message: 'machineId, date si shift sunt obligatorii.' });
  res.json(await getAvailableOperators(machineId, date, shift));
});
