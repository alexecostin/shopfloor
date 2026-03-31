import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as v from './planning.validation.js';
import * as c from './planning.controller.js';

const router = Router();
const mgr = authorize('admin', 'production_manager');

router.use(authenticate);

// Master Plans
router.get('/master-plans', c.getMasterPlans);
router.get('/master-plans/:id', c.getMasterPlanById);
router.post('/master-plans', mgr, validate(v.createMasterPlan), c.postMasterPlan);
router.put('/master-plans/:id', mgr, validate(v.updateMasterPlan), c.putMasterPlan);

// Allocations
router.get('/allocations', c.getAllocations);
router.post('/allocations', mgr, validate(v.createAllocation), c.postAllocation);
router.post('/allocations/bulk', mgr, validate(v.bulkAllocations), c.postBulkAllocations);
router.put('/allocations/:id', mgr, validate(v.updateAllocation), c.putAllocation);
router.delete('/allocations/:id', mgr, c.deleteAllocation);

// Smart Allocation
router.get('/allocation-context/:machineId', c.getAllocationContext);
router.get('/machine-load/:machineId', c.getMachineLoad);

// Capacity
router.get('/capacity', c.getCapacity);

// Customer Demands
router.get('/demands', c.getDemands);
router.post('/demands', mgr, validate(v.createDemand), c.postDemand);
router.post('/demands/bulk', mgr, validate(v.bulkDemands), c.postBulkDemands);

// Dashboard
router.get('/dashboard', c.getDashboard);

// Replan approval
router.put('/replan/:id/approve', mgr, c.approveReplan);
router.put('/replan/:id/reject', mgr, c.rejectReplan);

export default router;
