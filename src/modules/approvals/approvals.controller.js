import * as engine from '../../services/approval-engine.service.js';
import db from '../../config/db.js';

const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

// Workflow management
export const listWorkflows = wrap(async (req, res) => {
  const tenantId = req.user?.tenantId;
  let q = db('approvals.workflow_definitions');
  if (tenantId) q = q.where({ tenant_id: tenantId });
  res.json(await q.orderBy('document_type'));
});

export const createWorkflow = wrap(async (req, res) => {
  const tenantId = req.user?.tenantId;
  const { documentType, name, levels, levelConfig, autoApproveConditions } = req.body;
  const [wf] = await db('approvals.workflow_definitions').insert({
    tenant_id: tenantId || null,
    document_type: documentType,
    name,
    levels,
    level_config: JSON.stringify(levelConfig),
    auto_approve_conditions: autoApproveConditions ? JSON.stringify(autoApproveConditions) : null,
  }).onConflict(['tenant_id', 'document_type']).merge().returning('*');
  res.status(201).json(wf);
});

export const updateWorkflow = wrap(async (req, res) => {
  const { name, levels, levelConfig, isActive } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (levels !== undefined) updates.levels = levels;
  if (levelConfig !== undefined) updates.level_config = JSON.stringify(levelConfig);
  if (isActive !== undefined) updates.is_active = isActive;
  const [wf] = await db('approvals.workflow_definitions').where({ id: req.params.id }).update(updates).returning('*');
  if (!wf) return res.status(404).json({ error: 'Workflow negasit.' });
  res.json(wf);
});

// Submissions
export const submit = wrap(async (req, res) => {
  const { documentType, documentId, documentReference } = req.body;
  const tenantId = req.user?.tenantId;
  const result = await engine.submitForApproval(tenantId, documentType, documentId, documentReference, req.user.userId);
  res.status(201).json(result);
});

export const getPending = wrap(async (req, res) => {
  const tenantId = req.user?.tenantId;
  res.json(await engine.getPendingApprovals(req.user.userId, tenantId));
});

export const getMySubmissions = wrap(async (req, res) => {
  const tenantId = req.user?.tenantId;
  res.json(await engine.getMySubmissions(req.user.userId, tenantId));
});

export const getRequest = wrap(async (req, res) => {
  const detail = await engine.getRequestDetail(req.params.requestId);
  if (!detail) return res.status(404).json({ error: 'Cerere negasita.' });
  res.json(detail);
});

export const approve = wrap(async (req, res) => {
  const result = await engine.approveStep(req.params.requestId, req.user.userId, req.body.comment);
  res.json(result);
});

export const reject = wrap(async (req, res) => {
  const result = await engine.rejectStep(req.params.requestId, req.user.userId, req.body.comment);
  res.json(result);
});

export const getHistory = wrap(async (req, res) => {
  res.json(await engine.getDocumentHistory(req.params.documentType, req.params.documentId));
});

export const getVersions = wrap(async (req, res) => {
  res.json(await engine.getDocumentVersions(req.params.documentType, req.params.documentId));
});
