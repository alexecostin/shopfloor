import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as svc from '../../services/integration.service.js';

const router = Router();
router.use(authenticate);

// ─── Export Templates ─────────────────────────────────────────────────────

router.get('/templates', async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId;
    res.json(await svc.listTemplates(tenantId));
  } catch (e) { next(e); }
});

router.post('/templates', async (req, res, next) => {
  try {
    const data = { ...req.body, tenant_id: req.user?.tenantId };
    res.status(201).json(await svc.createTemplate(data));
  } catch (e) { next(e); }
});

router.put('/templates/:id', async (req, res, next) => {
  try {
    const row = await svc.updateTemplate(req.params.id, req.body);
    if (!row) return res.status(404).json({ message: 'Template-ul nu a fost gasit' });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete('/templates/:id', async (req, res, next) => {
  try {
    await svc.deleteTemplate(req.params.id);
    res.json({ message: 'Template sters.' });
  } catch (e) { next(e); }
});

// ─── Export Data ──────────────────────────────────────────────────────────

router.post('/export', async (req, res, next) => {
  try {
    const { templateId, dateFrom, dateTo } = req.body;
    if (!templateId) return res.status(400).json({ message: 'templateId este obligatoriu' });
    const result = await svc.exportData(templateId, dateFrom, dateTo, req.user?.userId);
    res.json(result);
  } catch (e) { next(e); }
});

// ─── Export Logs ──────────────────────────────────────────────────────────

router.get('/export-logs', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    res.json(await svc.listExportLogs(req.user?.tenantId, Number(page) || 1, Number(limit) || 50));
  } catch (e) { next(e); }
});

// ─── Webhooks ─────────────────────────────────────────────────────────────

router.get('/webhooks', async (req, res, next) => {
  try {
    res.json(await svc.listWebhooks(req.user?.tenantId));
  } catch (e) { next(e); }
});

router.post('/webhooks', async (req, res, next) => {
  try {
    const data = { ...req.body, tenant_id: req.user?.tenantId };
    res.status(201).json(await svc.createWebhook(data));
  } catch (e) { next(e); }
});

router.put('/webhooks/:id', async (req, res, next) => {
  try {
    const row = await svc.updateWebhook(req.params.id, req.body);
    if (!row) return res.status(404).json({ message: 'Webhook-ul nu a fost gasit' });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete('/webhooks/:id', async (req, res, next) => {
  try {
    await svc.deleteWebhook(req.params.id);
    res.json({ message: 'Webhook sters.' });
  } catch (e) { next(e); }
});

router.post('/webhooks/:id/test', async (req, res, next) => {
  try {
    const result = await svc.testWebhook(req.params.id);
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
