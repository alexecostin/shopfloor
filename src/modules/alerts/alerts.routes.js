import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as c from './alerts.controller.js';

const router = Router();
router.use(authenticate);
const mgr = authorize('admin', 'production_manager');

// Rules
router.get('/rules', c.listRules);
router.post('/rules', mgr, c.createRule);
router.put('/rules/:id', mgr, c.updateRule);
router.delete('/rules/:id', mgr, c.deleteRule);

// Channels
router.get('/rules/:ruleId/channels', c.listChannels);
router.post('/rules/:ruleId/channels', mgr, c.createChannel);
router.delete('/channels/:id', mgr, c.deleteChannel);

// Alerts
router.get('/count', c.getAlertCount);
router.get('/', c.listAlerts);
router.put('/:id/acknowledge', c.acknowledgeAlert);
router.put('/:id/resolve', c.resolveAlert);

// Manual trigger (admin only)
router.post('/check', authorize('admin'), c.triggerCheck);

export default router;
