import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as c from './costs.controller.js';

const router = Router();
router.use(authenticate);
const mgr = authorize('admin', 'production_manager');

router.get('/by-order/:orderId', c.byOrder);
router.get('/by-product/:productId', c.byProduct);
router.get('/by-machine', c.byMachine);
router.get('/by-operator', c.byOperator);
router.get('/profitability', c.profitability);
router.post('/snapshot/:orderId', mgr, c.snapshot);
router.get('/snapshots', c.listSnapshots);

// Cost element definitions
router.get('/elements', c.listElements);
router.put('/elements/:id', mgr, c.updateElement);

// Machine cost config
router.get('/machines/:machineId/config', c.getMachineCostConfig);
router.post('/machines/:machineId/config', mgr, c.setMachineCostConfig);

// Operator cost config
router.get('/operators/config', c.listOperatorConfigs);
router.post('/operators/config', mgr, c.setOperatorConfigs);

// Overhead config
router.get('/overhead', c.listOverhead);
router.post('/overhead', mgr, c.createOverhead);
router.put('/overhead/:id', mgr, c.updateOverhead);
router.delete('/overhead/:id', mgr, c.deleteOverhead);

// Cost calculations
router.get('/calculate/piece/:productId', c.calculatePieceCost);
router.get('/calculate/order/:orderId', c.calculateOrderCost);
router.get('/calculate/quote', c.calculateQuote);

export default router;
