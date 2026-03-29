import * as service from './checklists.service.js';

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

export const listTemplates = wrap(async (req, res) => {
  const { machineType, isActive } = req.query;
  res.json(await service.listTemplates({ machineType, isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined }));
});

export const getTemplate = wrap(async (req, res) => res.json(await service.getTemplate(req.params.id)));

export const createTemplate = wrap(async (req, res) => {
  res.status(201).json(await service.createTemplate(req.body));
});

export const updateTemplate = wrap(async (req, res) => {
  res.json(await service.updateTemplate(req.params.id, req.body));
});

export const complete = wrap(async (req, res) => {
  res.status(201).json(await service.completeChecklist(req.body, req.user.userId));
});

export const listCompletions = wrap(async (req, res) => {
  const { machineId, operatorId, templateId, page, limit } = req.query;
  res.json(await service.listCompletions({ machineId, operatorId, templateId, page: +page || 1, limit: +limit || 50 }));
});
