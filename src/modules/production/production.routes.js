import { Router } from 'express';
import * as c from './production.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import moduleGuard from '../../middleware/moduleGuard.js';
import { validate } from '../../middleware/validate.js';
import {
  createOrderSchema, updateOrderSchema,
  createReportSchema,
  createStopSchema, closeStopSchema,
  createShiftSchema, closeShiftSchema,
} from './production.validation.js';

const router = Router();
const mgr = authorize('admin', 'production_manager');
const leader = authorize('admin', 'production_manager', 'shift_leader');
const op = authorize('admin', 'production_manager', 'shift_leader', 'operator');

router.use(authenticate);
router.use(moduleGuard('production'));

// Orders
router.get('/orders', c.listOrders);
router.post('/orders', mgr, validate(createOrderSchema), c.createOrder);
router.get('/orders/:id', c.getOrder);
router.put('/orders/:id', mgr, validate(updateOrderSchema), c.updateOrder);

// Reports
router.get('/reports', c.listReports);
router.post('/reports', op, validate(createReportSchema), c.createReport);

// Stops
router.get('/stops', c.listStops);
router.post('/stops', op, validate(createStopSchema), c.createStop);
router.put('/stops/:id', op, validate(closeStopSchema), c.closeStop);

// Shifts
router.get('/shifts', c.listShifts);
router.post('/shifts', leader, validate(createShiftSchema), c.createShift);
router.put('/shifts/:id', leader, validate(closeShiftSchema), c.closeShift);

// Dashboard
router.get('/dashboard', c.getDashboard);

export default router;
