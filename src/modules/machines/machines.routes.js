import { Router } from 'express';
import * as controller from './machines.controller.js';
import * as pc from '../maintenance/planned.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import moduleGuard from '../../middleware/moduleGuard.js';
import { validate } from '../../middleware/validate.js';
import { createMachineSchema, updateMachineSchema, assignOperatorSchema } from './machines.validation.js';

const router = Router();

router.use(authenticate);
router.use(moduleGuard('machines'));

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

export default router;
