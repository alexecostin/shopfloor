import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as v from './inventory.validation.js';
import * as c from './inventory.controller.js';
import * as suppliers from './item-suppliers.service.js';
import * as mrpSvc from '../../services/mrp.service.js';
import * as aggPurchasing from '../../services/aggregated-purchasing.service.js';
import * as locSvc from '../../services/location.service.js';
import * as remSvc from '../../services/remnant.service.js';

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

// Locations
router.get('/locations', async (req, res, next) => {
  try {
    const tenantId = req.tenantFilter?.tenantId || null;
    res.json(await locSvc.listLocations(tenantId, req.query.type));
  } catch (e) { next(e); }
});
router.post('/locations', mgr, async (req, res, next) => {
  try { res.status(201).json(await locSvc.createLocation(req.body)); } catch (e) { next(e); }
});
router.put('/locations/:id', mgr, async (req, res, next) => {
  try { res.json(await locSvc.updateLocation(req.params.id, req.body)); } catch (e) { next(e); }
});
router.delete('/locations/:id', mgr, async (req, res, next) => {
  try { await locSvc.deleteLocation(req.params.id); res.json({ message: 'Locatie dezactivata.' }); } catch (e) { next(e); }
});

// Remnants
router.get('/remnants', async (req, res, next) => {
  try {
    const tenantId = req.tenantFilter?.tenantId || null;
    res.json(await remSvc.listRemnants(tenantId, req.query));
  } catch (e) { next(e); }
});
router.post('/remnants', ops, async (req, res, next) => {
  try { res.status(201).json(await remSvc.createRemnant(req.body)); } catch (e) { next(e); }
});
router.get('/remnants/match', async (req, res, next) => {
  try {
    const { materialGrade, shape, requiredDiameter, requiredLength } = req.query;
    res.json(await remSvc.findMatchingRemnants(materialGrade, shape, requiredDiameter ? Number(requiredDiameter) : null, requiredLength ? Number(requiredLength) : null));
  } catch (e) { next(e); }
});
router.put('/remnants/:id/use', ops, async (req, res, next) => {
  try { await remSvc.useRemnant(req.params.id); res.json({ message: 'Rest marcat ca utilizat.' }); } catch (e) { next(e); }
});
router.put('/remnants/:id/scrap', ops, async (req, res, next) => {
  try { await remSvc.scrapRemnant(req.params.id); res.json({ message: 'Rest marcat ca rebut.' }); } catch (e) { next(e); }
});

// MRP - Material Requirements Planning
router.post('/mrp/calculate', authenticate, mgr, async (req, res, next) => {
  try {
    const { workOrderIds } = req.body;
    if (!Array.isArray(workOrderIds) || workOrderIds.length === 0) {
      return res.status(400).json({ message: 'workOrderIds este obligatoriu si trebuie sa fie un array.' });
    }
    const results = await mrpSvc.calculateRequirements(workOrderIds);
    res.json(results);
  } catch (e) { next(e); }
});

router.post('/mrp/generate-pos', authenticate, mgr, async (req, res, next) => {
  try {
    const { requirements } = req.body;
    if (!Array.isArray(requirements)) {
      return res.status(400).json({ message: 'requirements este obligatoriu si trebuie sa fie un array.' });
    }
    const pos = await mrpSvc.generatePOsFromMRP(requirements, req.user?.id);
    res.json(pos);
  } catch (e) { next(e); }
});

// Aggregated Purchasing from MRP
router.post('/mrp/aggregated-pos', authenticate, mgr, async (req, res, next) => {
  try {
    const { workOrderIds } = req.body;
    if (!Array.isArray(workOrderIds) || workOrderIds.length === 0) {
      return res.status(400).json({ message: 'workOrderIds este obligatoriu si trebuie sa fie un array.' });
    }
    const result = await aggPurchasing.generateAggregatedPOs(workOrderIds);
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/mrp/create-pos', authenticate, mgr, async (req, res, next) => {
  try {
    const { suppliers: supplierGroups } = req.body;
    if (!Array.isArray(supplierGroups) || supplierGroups.length === 0) {
      return res.status(400).json({ message: 'suppliers este obligatoriu si trebuie sa fie un array.' });
    }
    const pos = await aggPurchasing.createAggregatedPOs(supplierGroups, req.user?.userId || req.user?.id);
    res.json(pos);
  } catch (e) { next(e); }
});

export default router;
