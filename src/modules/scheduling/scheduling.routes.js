import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as c from './scheduling.controller.js';

const router = Router();
router.use(authenticate);
const mgr = authorize('admin', 'production_manager');

// Configs
router.get('/configs', c.listConfigs);
router.post('/configs', mgr, c.createConfig);
router.put('/configs/:id', mgr, c.updateConfig);
router.delete('/configs/:id', mgr, c.deleteConfig);
router.put('/configs/:id/set-default', mgr, c.setDefaultConfig);

// Generate (placeholder)
router.post('/generate', mgr, c.generateSchedule);

// Runs
router.get('/runs', c.listRuns);
router.get('/runs/:id', c.getRun);
router.delete('/runs/:id', mgr, c.deleteRun);
router.get('/runs/:runId/operations', c.getRunOperations);
router.get('/runs/:runId/gantt', c.getGanttData);
router.post('/runs/:id/apply', mgr, c.applyRun);

// Operations
router.put('/operations/:id', mgr, c.updateOperation);

// Simulations
router.get('/simulations', c.listSimulations);
router.post('/simulations', mgr, c.createSimulation);
router.get('/simulations/:id', c.getSimulation);
router.get('/simulations/:id/compare', c.compareSimulation);
router.post('/simulations/:id/apply', mgr, c.applySimulation);
router.delete('/simulations/:id', mgr, c.deleteSimulation);

export default router;
