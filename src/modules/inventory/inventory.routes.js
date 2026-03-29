import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as v from './inventory.validation.js';
import * as c from './inventory.controller.js';

const router = Router();
const mgr = authorize('admin', 'production_manager');
const ops = authorize('admin', 'production_manager', 'shift_leader', 'operator');

router.use(authenticate);

// Items
router.get('/items', c.getItems);
router.post('/items', mgr, validate(v.createItem), c.postItem);
router.put('/items/:id', mgr, validate(v.updateItem), c.putItem);

// Stock Levels
router.get('/stock-levels', c.getStockLevels);
router.get('/alerts', c.getAlerts);

// Movements
router.get('/movements', c.getMovements);
router.post('/movements', ops, validate(v.createMovement), c.postMovement);

// Material Requirements
router.get('/material-requirements', c.getRequirements);
router.post('/material-requirements/calculate', mgr, validate(v.calculateRequirements), c.postCalculateRequirements);

// Warehouse Documents
router.get('/documents', c.getDocuments);
router.get('/documents/:id', c.getDocumentById);
router.post('/documents', ops, validate(v.createDocument), c.postDocument);
router.put('/documents/:id/confirm', mgr, c.confirmDocument);

// Dashboard
router.get('/dashboard', c.getDashboard);

export default router;
