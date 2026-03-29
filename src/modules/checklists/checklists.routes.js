import { Router } from 'express';
import * as c from './checklists.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createTemplateSchema, updateTemplateSchema, completeChecklistSchema } from './checklists.validation.js';

const router = Router();
const mgr = authorize('admin', 'production_manager');

router.get('/templates', authenticate, c.listTemplates);
router.get('/templates/:id', authenticate, c.getTemplate);
router.post('/templates', authenticate, mgr, validate(createTemplateSchema), c.createTemplate);
router.put('/templates/:id', authenticate, mgr, validate(updateTemplateSchema), c.updateTemplate);
router.post('/complete', authenticate, validate(completeChecklistSchema), c.complete);
router.get('/completions', authenticate, c.listCompletions);

export default router;
