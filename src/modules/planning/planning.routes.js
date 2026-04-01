import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as v from './planning.validation.js';
import * as c from './planning.controller.js';
import * as smartScheduler from '../../services/smart-scheduler.service.js';

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

// Pieces (aggregated from all orders)
router.get('/pieces', c.getPieces);
router.get('/pieces/machine/:machineId', c.getMachinePieces);

// Capacity
router.get('/capacity', c.getCapacity);

// Customer Demands
router.get('/demands', c.getDemands);
router.post('/demands', mgr, validate(v.createDemand), c.postDemand);
router.post('/demands/bulk', mgr, validate(v.bulkDemands), c.postBulkDemands);

// Dashboard
router.get('/dashboard', c.getDashboard);

// CTP — Capable To Promise
router.post('/ctp', c.postCTP);

// Replan approval
router.put('/replan/:id/approve', mgr, c.approveReplan);
router.put('/replan/:id/reject', mgr, c.rejectReplan);

// Smart Scheduling
router.post('/smart-schedule', mgr, async (req, res, next) => {
  try {
    const { configId, periodStart, periodEnd } = req.body;
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ message: 'periodStart si periodEnd sunt obligatorii.' });
    }
    const result = await smartScheduler.generateSmartPlan(configId || null, periodStart, periodEnd, req.user.userId);
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/smart-schedule/apply', mgr, async (req, res, next) => {
  try {
    const { planResult, periodStart, periodEnd } = req.body;
    if (!planResult || !planResult.allocations) {
      return res.status(400).json({ message: 'planResult cu allocations este obligatoriu.' });
    }
    const result = await smartScheduler.applySmartPlan(planResult, periodStart, periodEnd, req.user.userId);
    res.status(201).json(result);
  } catch (e) { next(e); }
});

export default router;
