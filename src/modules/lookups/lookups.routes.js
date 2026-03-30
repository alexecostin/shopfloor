import { Router } from 'express';
import * as c from './lookups.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createValueSchema, updateValueSchema } from './lookups.validation.js';

const router = Router();
const adm = authorize('admin', 'production_manager');

router.use(authenticate);

router.get('/', c.listTypes);
router.get('/:lookupType', c.listValues);
router.post('/:lookupType', adm, validate(createValueSchema), c.createValue);
router.put('/:lookupType/:code', adm, validate(updateValueSchema), c.updateValue);
router.delete('/:lookupType/:code', adm, c.deactivateValue);
router.post('/:lookupType/reset', adm, c.resetType);

export default router;
