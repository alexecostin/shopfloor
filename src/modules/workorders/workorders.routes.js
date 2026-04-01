import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as c from './workorders.controller.js';

const router = Router();
const mgr = authorize('admin', 'production_manager');

router.use(authenticate);

// Work Orders
router.get('/', c.listWorkOrders);
router.get('/statuses', c.listStatuses);
router.get('/:id', c.getWorkOrder);
router.post('/', mgr, c.createWorkOrder);
router.put('/:id', mgr, c.updateWorkOrder);

// Status transitions
router.get('/:id/next-statuses', c.getNextStatuses);
router.put('/:id/status', mgr, c.changeStatus);

// Operations pe comanda de lucru
router.put('/operations/:id', mgr, c.updateOperation);

// Technical Checks
router.get('/:id/technical-checks', c.getTechnicalChecks);
router.put('/technical-checks/:checkId', mgr, c.updateTechnicalCheck);

// Material Status
router.get('/:id/material-status', c.getMaterialStatus);

// Launch to Production
router.post('/:id/launch', mgr, c.launchToProduction);

// HR Allocations
router.get('/:id/cost', c.getWorkOrderCost);
router.post('/:id/hr', mgr, c.addHrAllocation);
router.delete('/hr/:id', mgr, c.removeHrAllocation);

// HR Cost Rates
router.get('/hr-rates/all', c.listHrRates);
router.post('/hr-rates', authorize('admin'), c.createHrRate);

export default router;
