import { Router } from 'express';
import * as controller from './machines.controller.js';
import * as kpiController from './machine-kpi.controller.js';
import * as pc from '../maintenance/planned.controller.js';
import * as certSvc from '../../services/certification.service.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import moduleGuard from '../../middleware/moduleGuard.js';
import { validate } from '../../middleware/validate.js';
import { createMachineSchema, updateMachineSchema, assignOperatorSchema } from './machines.validation.js';

const router = Router();

router.use(authenticate);
router.use(moduleGuard('machines'));

// KPI routes (before /:id to avoid param conflicts)
router.get('/kpi/comparison', kpiController.comparison);
router.get('/:id/kpi', kpiController.getDashboard);
router.get('/:id/kpi/trend', kpiController.getTrend);

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', authorize('admin'), validate(createMachineSchema), controller.create);
router.put('/:id', authorize('admin'), validate(updateMachineSchema), controller.update);
router.delete('/:id', authorize('admin'), controller.remove);

router.post('/:id/operators', authorize('admin'), validate(assignOperatorSchema), controller.assignOperator);
router.delete('/:id/operators/:userId', authorize('admin'), controller.removeOperator);

router.get('/:id/capabilities', controller.listCapabilities);
router.post('/:id/capabilities', authorize('admin', 'production_manager'), controller.addCapability);
router.put('/capabilities/:id', authorize('admin', 'production_manager'), controller.updateCapability);
router.delete('/capabilities/:id', authorize('admin'), controller.deleteCapability);

router.get('/:id/planning', controller.getMachinePlanning);

router.get('/groups/all', controller.listGroups);
router.get('/groups/:id', controller.getGroup);
router.post('/groups', authorize('admin', 'production_manager'), controller.createGroup);
router.put('/groups/:id', authorize('admin', 'production_manager'), controller.updateGroup);
router.post('/groups/:id/machines', authorize('admin', 'production_manager'), controller.addMachineToGroup);
router.delete('/groups/:id/machines/:machineId', authorize('admin'), controller.removeMachineFromGroup);

// Maintenance schedules
router.get('/:machineId/maintenance-schedules', pc.listSchedules);
router.post('/:machineId/maintenance-schedules', authorize('admin', 'production_manager', 'maintenance'), pc.createSchedule);
router.put('/maintenance-schedules/:id', authorize('admin', 'production_manager', 'maintenance'), pc.updateSchedule);
router.delete('/maintenance-schedules/:id', authorize('admin'), pc.deleteSchedule);

// Certification routes
const certMgr = authorize('admin', 'production_manager');

router.get('/:id/certified-operators', async (req, res, next) => {
  try { res.json(await certSvc.getCertifiedOperators(req.params.id)); } catch (e) { next(e); }
});

router.get('/:id/can-operate/:userId', async (req, res, next) => {
  try { res.json(await certSvc.canOperateMachine(req.params.userId, req.params.id)); } catch (e) { next(e); }
});

router.post('/:id/certifications', certMgr, async (req, res, next) => {
  try { res.status(201).json(await certSvc.addCertification(req.body)); } catch (e) { next(e); }
});

router.delete('/certifications/:id', certMgr, async (req, res, next) => {
  try { await certSvc.removeCertification(req.params.id); res.json({ message: 'Certificare dezactivata.' }); } catch (e) { next(e); }
});

router.post('/:id/certification-exceptions', certMgr, async (req, res, next) => {
  try { res.status(201).json(await certSvc.addException(req.body)); } catch (e) { next(e); }
});

router.delete('/certification-exceptions/:id', certMgr, async (req, res, next) => {
  try { await certSvc.removeException(req.params.id); res.json({ message: 'Exceptie stearsa.' }); } catch (e) { next(e); }
});

export default router;
