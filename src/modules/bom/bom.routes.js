import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as v from './bom.validation.js';
import * as c from './bom.controller.js';

const router = Router();
const mgr = authorize('admin', 'production_manager');
const adm = authorize('admin');

router.use(authenticate);

// Products
router.get('/products', c.getProducts);
router.get('/products/:id', c.getProductById);
router.post('/products', mgr, validate(v.createProduct), c.postProduct);
router.put('/products/:id', mgr, validate(v.updateProduct), c.putProduct);

// Operations
router.get('/products/:productId/operations', c.getOperations);
router.post('/products/:productId/operations', mgr, validate(v.createOperation), c.postOperation);
router.put('/operations/:id', mgr, c.putOperation);
router.delete('/operations/:id', adm, c.deleteOperation);

// Materials
router.get('/products/:productId/materials', c.getMaterials);
router.post('/products/:productId/materials', mgr, validate(v.createMaterial), c.postMaterial);
router.put('/materials/:id', mgr, c.putMaterial);
router.delete('/materials/:id', adm, c.deleteMaterial);

// Assembly Components
router.get('/products/:productId/components', c.getComponents);
router.post('/products/:productId/components', mgr, validate(v.createComponent), c.postComponent);
router.put('/components/:id', mgr, c.putComponent);

// Cost Rates
router.get('/cost-rates', c.getCostRates);
router.post('/cost-rates', adm, validate(v.createCostRate), c.postCostRate);

// Cost Calculator
router.get('/products/:id/cost', c.getProductCost);

// MBOM for Work Order
router.get('/mbom/order/:orderId', c.getMBOMForOrder);

// Operation Alternatives
router.post('/operations/:operationId/alternatives', mgr, c.postAlternative);
router.delete('/alternatives/:id', mgr, c.deleteAlternative);

// Validate MBOM
router.put('/products/:productId/validate', mgr, c.validateMBOM);

// Dependencies & Backward Scheduling
router.get('/products/:productId/dependencies', c.getProductDependencies);
router.post('/operations/:operationId/dependencies', mgr, c.addDependency);
router.delete('/dependencies/:id', mgr, c.removeDependency);
router.get('/products/:productId/backward-schedule', c.getBackwardSchedule);

export default router;
