import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as c from './tools.controller.js';

const router = Router();
router.use(authenticate);
const mgr = authorize('admin', 'production_manager');
const mgrOrMaint = authorize('admin', 'production_manager', 'maintenance');
const mgrOrShift = authorize('admin', 'production_manager', 'shift_leader');

router.get('/consumables/status', c.consumablesStatus);
router.get('/calibration/dashboard', c.calibrationDashboard);
router.get('/', c.list);
router.get('/:id', c.get);
router.post('/', mgr, c.create);
router.put('/:id', mgr, c.update);
router.delete('/:id', mgr, c.retire);
router.post('/:id/assign', mgrOrShift, c.assign);
router.put('/:id/cycles', mgrOrShift, c.updateCycles);
router.post('/:id/maintenance', mgrOrMaint, c.addMaintenance);
router.post('/:id/calibrate', mgrOrMaint, c.recordCalibration);

export default router;
