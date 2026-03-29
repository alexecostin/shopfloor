import { Router } from 'express';
import * as controller from './machines.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createMachineSchema, updateMachineSchema, assignOperatorSchema } from './machines.validation.js';

const router = Router();

router.get('/', authenticate, controller.list);
router.get('/:id', authenticate, controller.get);
router.post('/', authenticate, authorize('admin'), validate(createMachineSchema), controller.create);
router.put('/:id', authenticate, authorize('admin'), validate(updateMachineSchema), controller.update);
router.delete('/:id', authenticate, authorize('admin'), controller.remove);

router.post('/:id/operators', authenticate, authorize('admin'), validate(assignOperatorSchema), controller.assignOperator);
router.delete('/:id/operators/:userId', authenticate, authorize('admin'), controller.removeOperator);

export default router;
