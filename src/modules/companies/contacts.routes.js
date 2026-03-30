/**
 * Standalone /api/v1/contacts router.
 * Provides top-level contact endpoints for assign/query use-cases.
 */
import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as c from './companies.controller.js';

const router = Router();
const mgr = authorize('admin', 'production_manager');

router.use(authenticate);

// POST /api/v1/contacts/assign
router.post('/assign', mgr, c.assignContact);

// GET /api/v1/contacts/for/:entityType/:entityId
router.get('/for/:entityType/:entityId', c.getContactsForEntity);

export default router;
