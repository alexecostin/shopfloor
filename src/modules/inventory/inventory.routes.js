import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as v from './inventory.validation.js';
import * as c from './inventory.controller.js';
import * as suppliers from './item-suppliers.service.js';

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

// Item suppliers
router.get('/items/:itemId/suppliers', authenticate, async (req, res, next) => {
  try { res.json(await suppliers.listSuppliers(req.params.itemId)); } catch(e) { next(e); }
});
router.post('/items/:itemId/suppliers', authenticate, authorize('admin','production_manager'), async (req, res, next) => {
  try { res.status(201).json(await suppliers.addSupplier(req.params.itemId, req.body)); } catch(e) { next(e); }
});
router.put('/items/suppliers/:id', authenticate, authorize('admin','production_manager'), async (req, res, next) => {
  try { res.json(await suppliers.updateSupplier(req.params.id, req.body)); } catch(e) { next(e); }
});
router.delete('/items/suppliers/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try { await suppliers.removeSupplier(req.params.id); res.status(204).send(); } catch(e) { next(e); }
});
router.get('/items/:itemId/purchase-history', authenticate, async (req, res, next) => {
  try { res.json(await suppliers.getPurchaseHistory(req.params.itemId)); } catch(e) { next(e); }
});
router.get('/items/:itemId/price-trend', authenticate, async (req, res, next) => {
  try { res.json(await suppliers.getPriceTrend(req.params.itemId)); } catch(e) { next(e); }
});

export default router;
