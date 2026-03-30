import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import moduleGuard from '../../middleware/moduleGuard.js';
import * as reworkService from '../../services/rework.service.js';

const router = Router();
const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };

const mgr = authorize('admin', 'production_manager');
const leader = authorize('admin', 'production_manager', 'shift_leader');

router.use(authenticate);
router.use(moduleGuard('production'));

// GET /rework/stats — statistics (must be before :id route)
router.get('/stats', wrap(async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  const tenantId = req.tenantFilter?.tenantId || null;
  res.json(await reworkService.getStats(tenantId, dateFrom, dateTo));
}));

// GET /rework — list queue
router.get('/', wrap(async (req, res) => {
  const { status, orderId, machineId, page, limit } = req.query;
  res.json(await reworkService.listQueue({
    status, orderId, machineId,
    page: +page || 1, limit: +limit || 50,
  }));
}));

// GET /rework/:id — detail
router.get('/:id', wrap(async (req, res) => {
  res.json(await reworkService.getItem(req.params.id));
}));

// PUT /rework/:id — update (assign machine, notes, etc.)
router.put('/:id', leader, wrap(async (req, res) => {
  res.json(await reworkService.updateItem(req.params.id, req.body));
}));

// POST /rework/:id/start — start rework
router.post('/:id/start', leader, wrap(async (req, res) => {
  res.json(await reworkService.startRework(req.params.id));
}));

// POST /rework/:id/complete — complete with good/scrapped counts
router.post('/:id/complete', leader, wrap(async (req, res) => {
  const { reworkGood, reworkScrapped, notes } = req.body;
  res.json(await reworkService.completeRework(req.params.id, {
    reworkGood: +reworkGood || 0,
    reworkScrapped: +reworkScrapped || 0,
    notes,
  }));
}));

export default router;
