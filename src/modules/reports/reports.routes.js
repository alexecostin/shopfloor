import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as c from './reports.controller.js';
import { generateReportPDF } from '../../services/pdf.service.js';

const router = Router();
router.use(authenticate);

const mgr = authorize('admin', 'production_manager');

// PRR endpoints
router.get('/prr/by-product', c.prrByProduct);
router.get('/prr/by-machine', c.prrByMachine);
router.get('/prr/by-order/:orderId', c.prrByOrder);
router.get('/prr/by-operator', c.prrByOperator);
router.get('/prr/weekly-summary', c.weeklySummary);
router.get('/prr/trend', c.trend);
router.get('/prr/month-comparison', c.monthComparison);

// Saved reports
router.get('/saved', c.listSaved);
router.post('/saved', mgr, c.createSaved);
router.delete('/saved/:id', mgr, c.deleteSaved);

// Export
router.get('/export/pdf', async (req, res, next) => {
  try {
    const { type, ...params } = req.query;
    const buf = await generateReportPDF(type || 'production', params);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="report-${type}.pdf"` });
    res.send(buf);
  } catch (e) { next(e); }
});

router.get('/export/excel', async (req, res, next) => {
  try {
    const { type, ...params } = req.query;
    // Use existing pdf service for now, add excel export
    res.status(501).json({ message: 'Excel export coming soon.' });
  } catch (e) { next(e); }
});

export default router;
