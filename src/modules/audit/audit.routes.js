import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as auditSvc from '../../services/audit.service.js';

const router = Router();
router.use(authenticate);
const admin = authorize('admin');

router.get('/actions', async (req, res, next) => {
  try {
    const { actionType, userId, entityType, entityId, dateFrom, dateTo, page, limit } = req.query;
    res.json(await auditSvc.listBusinessActions({
      actionType, userId, entityType, entityId, dateFrom, dateTo,
      tenantId: req.user?.tenantId, page: +page || 1, limit: +limit || 50,
    }));
  } catch (e) { next(e); }
});

router.get('/actions/summary', async (req, res, next) => {
  try {
    res.json(await auditSvc.getActionsSummary(req.user?.tenantId, req.query.period));
  } catch (e) { next(e); }
});

router.get('/changes', admin, async (req, res, next) => {
  try {
    const { tableSchema, tableName, recordId, changedBy, dateFrom, dateTo, page, limit } = req.query;
    res.json(await auditSvc.listChanges({
      tableSchema, tableName, recordId, changedBy, dateFrom, dateTo,
      page: +page || 1, limit: +limit || 50,
    }));
  } catch (e) { next(e); }
});

router.get('/entity/:entityType/:entityId', async (req, res, next) => {
  try {
    res.json(await auditSvc.getEntityHistory(req.params.entityType, req.params.entityId));
  } catch (e) { next(e); }
});

export default router;
