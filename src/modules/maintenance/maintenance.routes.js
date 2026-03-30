import { Router } from 'express';
import * as c from './maintenance.controller.js';
import * as pc from './planned.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import moduleGuard from '../../middleware/moduleGuard.js';
import { validate } from '../../middleware/validate.js';
import { createRequestSchema, updateRequestSchema } from './maintenance.validation.js';

const router = Router();

router.use(authenticate);
router.use(moduleGuard('maintenance'));

router.get('/', c.list);
router.get('/dashboard', authorize('admin', 'production_manager', 'maintenance'), c.dashboard);

// Planned interventions
router.get('/planned', pc.listPlanned);
router.post('/planned', authorize('admin', 'production_manager', 'maintenance'), pc.createPlanned);
router.get('/planned/:id', pc.getPlanned);
router.put('/planned/:id/confirm', authorize('admin', 'production_manager', 'maintenance'), pc.confirmPlanned);
router.put('/planned/:id/start', authorize('admin', 'production_manager', 'maintenance'), pc.startPlanned);
router.put('/planned/:id/complete', authorize('admin', 'production_manager', 'maintenance'), pc.completePlanned);

router.get('/:id', c.get);
router.post('/', validate(createRequestSchema), c.create);
router.put('/:id', authorize('admin', 'production_manager', 'maintenance'), validate(updateRequestSchema), c.update);

export default router;
