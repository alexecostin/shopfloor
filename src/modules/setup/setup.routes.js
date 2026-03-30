import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as c from './setup.controller.js';

const router = Router();
router.use(authenticate);
const mgr = authorize('admin', 'production_manager');

// Machine setup defaults & overrides
router.get('/machines/:machineId', c.getMachineSetup);
router.post('/machines/:machineId/default', mgr, c.setDefault);
router.get('/machines/:machineId/overrides', c.listOverrides);
router.post('/machines/:machineId/overrides', mgr, c.createOverride);
router.put('/overrides/:id', mgr, c.updateOverride);
router.delete('/overrides/:id', mgr, c.deleteOverride);

// Factor definitions
router.get('/factors', c.listFactors);
router.post('/factors', authorize('admin'), c.createFactor);
router.put('/factors/:id', authorize('admin'), c.updateFactor);

// Factor values per machine+product
router.get('/machines/:machineId/factors/:productId', c.getFactorValues);
router.post('/machines/:machineId/factors/:productId', mgr, c.setFactorValues);

// Calculate
router.get('/calculate', c.calculate);

export default router;
