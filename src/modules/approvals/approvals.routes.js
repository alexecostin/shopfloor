import { Router } from 'express';
import * as c from './approvals.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = Router();
const admin = authorize('admin');
const adminOrMgr = authorize('admin', 'production_manager');

router.use(authenticate);

// Workflow management (admin only)
router.get('/workflows', c.listWorkflows);
router.post('/workflows', admin, c.createWorkflow);
router.put('/workflows/:id', adminOrMgr, c.updateWorkflow);

// Approval actions
router.post('/submit', c.submit);
router.get('/pending', c.getPending);
router.get('/my-submissions', c.getMySubmissions);
router.get('/history/:documentType/:documentId', c.getHistory);
router.get('/versions/:documentType/:documentId', c.getVersions);
router.get('/:requestId', c.getRequest);
router.post('/:requestId/approve', c.approve);
router.post('/:requestId/reject', c.reject);

export default router;
