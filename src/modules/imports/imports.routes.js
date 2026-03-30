import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import multer from 'multer';
import * as c from './imports.controller.js';

const router = Router();
router.use(authenticate);
const mgr = authorize('admin', 'production_manager');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Templates
router.get('/templates', c.listTemplates);
router.post('/templates', mgr, c.createTemplate);
router.put('/templates/:id', mgr, c.updateTemplate);
router.delete('/templates/:id', mgr, c.deleteTemplate);

// Import flow
router.post('/upload', mgr, upload.single('file'), c.upload);
router.post('/:importLogId/map', mgr, c.mapImport);
router.post('/:importLogId/confirm', mgr, c.confirmImportHandler);
router.post('/paste', mgr, c.pasteImport);

// Logs
router.get('/logs', c.listLogs);
router.get('/logs/:id', c.getLog);

// Email
router.get('/email/inbox', c.listEmailInbox);
router.post('/email/inbox/:id/process', mgr, c.processEmailInbox);
router.post('/email/simulate', mgr, c.simulateEmail);

export default router;
