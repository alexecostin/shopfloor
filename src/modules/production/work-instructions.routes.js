import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import moduleGuard from '../../middleware/moduleGuard.js';
import * as wiService from '../../services/work-instructions.service.js';

const router = Router();
const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };

const mgr = authorize('admin', 'production_manager');

router.use(authenticate);
router.use(moduleGuard('production'));

// GET / — list with filters
router.get('/', wrap(async (req, res) => {
  const { productId, operationId, machineType, machineId, page, limit } = req.query;
  res.json(await wiService.list({
    productId, operationId, machineType, machineId,
    page: +page || 1, limit: +limit || 50,
  }));
}));

// GET /for-operator?machineId=&orderId= — smart lookup for operator
router.get('/for-operator', wrap(async (req, res) => {
  const { machineId, orderId } = req.query;
  if (!machineId || !orderId) {
    return res.status(400).json({ error: 'PARAMETRI_LIPSA', message: 'machineId si orderId sunt obligatorii.' });
  }
  const result = await wiService.getForOperator(machineId, orderId);
  res.json(result);
}));

// GET /:id — detail
router.get('/:id', wrap(async (req, res) => {
  res.json(await wiService.getById(req.params.id));
}));

// POST / — create (manager/admin)
router.post('/', mgr, wrap(async (req, res) => {
  const userId = req.user?.id || null;
  const item = await wiService.create(req.body, userId);
  res.status(201).json(item);
}));

// PUT /:id — update (manager/admin)
router.put('/:id', mgr, wrap(async (req, res) => {
  res.json(await wiService.update(req.params.id, req.body));
}));

export default router;
