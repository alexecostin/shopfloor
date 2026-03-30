import { Router } from 'express';
import * as c from './checklists.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import moduleGuard from '../../middleware/moduleGuard.js';
import { validate } from '../../middleware/validate.js';
import { createTemplateSchema, updateTemplateSchema, completeChecklistSchema } from './checklists.validation.js';

const router = Router();
const mgr = authorize('admin', 'production_manager');

router.use(authenticate);
router.use(moduleGuard('checklists'));

router.get('/templates', c.listTemplates);
router.get('/templates/:id', c.getTemplate);
router.post('/templates', mgr, validate(createTemplateSchema), c.createTemplate);
router.put('/templates/:id', mgr, validate(updateTemplateSchema), c.updateTemplate);
router.post('/complete', validate(completeChecklistSchema), c.complete);
router.get('/completions', c.listCompletions);

export default router;
