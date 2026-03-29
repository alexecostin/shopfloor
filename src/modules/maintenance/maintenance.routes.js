import { Router } from 'express';
import * as c from './maintenance.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createRequestSchema, updateRequestSchema } from './maintenance.validation.js';

const router = Router();

router.get('/', authenticate, c.list);
router.get('/dashboard', authenticate, authorize('admin', 'production_manager', 'maintenance'), c.dashboard);
router.get('/:id', authenticate, c.get);
router.post('/', authenticate, validate(createRequestSchema), c.create);
router.put('/:id', authenticate, authorize('admin', 'production_manager', 'maintenance'), validate(updateRequestSchema), c.update);

export default router;
