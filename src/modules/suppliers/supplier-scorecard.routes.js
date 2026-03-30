import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as svc from '../../services/supplier-scorecard.service.js';

const router = Router();
const mgr = authorize('admin', 'production_manager', 'logistics', 'director');

router.use(authenticate);

// GET /suppliers/scorecards/ranking — all suppliers ranked
router.get('/scorecards/ranking', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const tenantId = req.user?.tenantId || null;
    res.json(await svc.getRanking(tenantId, dateFrom, dateTo));
  } catch (e) { next(e); }
});

// GET /suppliers/scorecards/:supplierId — scorecard for one supplier
router.get('/scorecards/:supplierId', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    res.json(await svc.getOverallScore(req.params.supplierId, dateFrom, dateTo));
  } catch (e) { next(e); }
});

// PUT /suppliers/scorecards/:supplierId/reactivity — set manual reactivity score
router.put('/scorecards/:supplierId/reactivity', mgr, async (req, res, next) => {
  try {
    const { score, notes } = req.body;
    res.json(await svc.setReactivity(req.params.supplierId, score, notes));
  } catch (e) { next(e); }
});

export default router;
