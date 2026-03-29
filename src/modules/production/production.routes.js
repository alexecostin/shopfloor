import { Router } from 'express';
import * as c from './production.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
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

// Orders
router.get('/orders', authenticate, c.listOrders);
router.post('/orders', authenticate, mgr, validate(createOrderSchema), c.createOrder);
router.get('/orders/:id', authenticate, c.getOrder);
router.put('/orders/:id', authenticate, mgr, validate(updateOrderSchema), c.updateOrder);

// Reports
router.get('/reports', authenticate, c.listReports);
router.post('/reports', authenticate, op, validate(createReportSchema), c.createReport);

// Stops
router.get('/stops', authenticate, c.listStops);
router.post('/stops', authenticate, op, validate(createStopSchema), c.createStop);
router.put('/stops/:id', authenticate, op, validate(closeStopSchema), c.closeStop);

// Shifts
router.get('/shifts', authenticate, c.listShifts);
router.post('/shifts', authenticate, leader, validate(createShiftSchema), c.createShift);
router.put('/shifts/:id', authenticate, leader, validate(closeShiftSchema), c.closeShift);

// Dashboard
router.get('/dashboard', authenticate, c.getDashboard);

export default router;
