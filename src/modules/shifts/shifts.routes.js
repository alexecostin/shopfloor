import { Router } from 'express';
import * as c from './shifts.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createDefinitionSchema, updateDefinitionSchema, upsertWeeklySchema, createExceptionSchema, updateExceptionSchema } from './shifts.validation.js';

const router = Router();
const mgr = authorize('admin', 'production_manager');

router.use(authenticate);

// Definitions
router.get('/definitions', c.listDefinitions);
router.post('/definitions', mgr, validate(createDefinitionSchema), c.createDefinition);
router.put('/definitions/:id', mgr, validate(updateDefinitionSchema), c.updateDefinition);
router.delete('/definitions/:id', mgr, c.deleteDefinition);

// Weekly schedule
router.get('/weekly', c.getWeekly);
router.put('/weekly', mgr, validate(upsertWeeklySchema), c.upsertWeekly);

// Exceptions
router.get('/exceptions', c.listExceptions);
router.post('/exceptions', mgr, validate(createExceptionSchema), c.createException);
router.put('/exceptions/:id', mgr, validate(updateExceptionSchema), c.updateException);
router.delete('/exceptions/:id', mgr, c.deleteException);

// Calendar view
router.get('/calendar', c.getCalendar);

// Utility
router.get('/current', c.getCurrentShift);
router.get('/available-hours', c.getAvailableHours);

export default router;
