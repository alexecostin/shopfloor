import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import * as themeService from './modules/admin/theme.service.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
import { globalLimiter } from './middleware/rateLimiter.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './config/logger.js';
import authRoutes from './modules/auth/auth.routes.js';
import machinesRoutes from './modules/machines/machines.routes.js';
import productionRoutes from './modules/production/production.routes.js';
import maintenanceRoutes from './modules/maintenance/maintenance.routes.js';
import checklistsRoutes from './modules/checklists/checklists.routes.js';
import bomRoutes from './modules/bom/bom.routes.js';
import planningRoutes from './modules/planning/planning.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import companiesRoutes from './modules/companies/companies.routes.js';
import contactsRoutes from './modules/companies/contacts.routes.js';
import importRoutes from './modules/import/import.routes.js';
import exportRoutes from './modules/export/export.routes.js';
import workordersRoutes from './modules/workorders/workorders.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import setupRoutes from './modules/setup/setup.routes.js';
import hrRoutes from './modules/hr/hr.routes.js';
import toolsRoutes from './modules/tools/tools.routes.js';
import schedulingRoutes from './modules/scheduling/scheduling.routes.js';
import costsRoutes from './modules/costs/costs.routes.js';
import alertsRoutes from './modules/alerts/alerts.routes.js';
import smartImportsRoutes from './modules/imports/imports.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import approvalsRoutes from './modules/approvals/approvals.routes.js';
import lookupsRoutes from './modules/lookups/lookups.routes.js';
import currenciesRoutes from './modules/currencies/currencies.routes.js';
import shiftsRoutes from './modules/shifts/shifts.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import reworkRoutes from './modules/production/rework.routes.js';
import barcodesRoutes from './modules/barcodes/barcodes.routes.js';
import traceabilityRoutes from './modules/traceability/traceability.routes.js';
import workInstructionsRoutes from './modules/production/work-instructions.routes.js';
import shipmentsRoutes from './modules/shipments/shipments.routes.js';
import purchasingRoutes from './modules/purchasing/purchasing.routes.js';
import qualityRoutes from './modules/quality/quality.routes.js';
import documentsRoutes from './modules/documents/documents.routes.js';
import supplierScorecardRoutes from './modules/suppliers/supplier-scorecard.routes.js';
import integrationsRoutes from './modules/integrations/integrations.routes.js';
import { checkAllRules } from './services/alert-engine.service.js';
import { processHeartbeat, checkAllLicenses } from './services/license.service.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing (with size limit to prevent abuse)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files (logos, etc.)
app.use('/uploads', express.static(resolve(__dirname, '../uploads')));

// Public theme endpoint (no auth needed)
app.get('/api/v1/theme/public', async (req, res, next) => {
  try {
    const slug = req.query.slug || null;
    res.json(await themeService.getPublicTheme(slug));
  } catch (e) { next(e); }
});

// Global rate limiter
app.use(globalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// License heartbeat (on-premise)
app.post('/api/v1/license/heartbeat', async (req, res, next) => {
  try {
    const result = await processHeartbeat(req.body);
    res.json(result);
  } catch (e) { next(e); }
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/machines', machinesRoutes);
app.use('/api/v1/production', productionRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);
app.use('/api/v1/checklists', checklistsRoutes);
app.use('/api/v1/bom', bomRoutes);
app.use('/api/v1/planning', planningRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/companies', companiesRoutes);
app.use('/api/v1/contacts', contactsRoutes);
app.use('/api/v1/import', importRoutes);
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/work-orders', workordersRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/setup', setupRoutes);
app.use('/api/v1/hr', hrRoutes);
app.use('/api/v1/tools', toolsRoutes);
app.use('/api/v1/scheduling', schedulingRoutes);
app.use('/api/v1/costs', costsRoutes);
app.use('/api/v1/alerts', alertsRoutes);
app.use('/api/v1/smart-imports', smartImportsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/approvals', approvalsRoutes);
app.use('/api/v1/lookups', lookupsRoutes);
app.use('/api/v1/currencies', currenciesRoutes);
app.use('/api/v1/shifts', shiftsRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/production/rework', reworkRoutes);
app.use('/api/v1/barcodes', barcodesRoutes);
app.use('/api/v1/traceability', traceabilityRoutes);
app.use('/api/v1/work-instructions', workInstructionsRoutes);
app.use('/api/v1/shipments', shipmentsRoutes);
app.use('/api/v1/purchasing', purchasingRoutes);
app.use('/api/v1/quality', qualityRoutes);
app.use('/api/v1/documents', documentsRoutes);
app.use('/api/v1/suppliers', supplierScorecardRoutes);
app.use('/api/v1/integrations', integrationsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ statusCode: 404, error: 'NU_GASIT', message: 'Ruta nu exista.' });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;

// Only start server when run directly (not imported in tests)
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    logger.info(`Server pornit pe portul ${PORT}`, { env: process.env.NODE_ENV });
  });

  // Alert engine: run every 30 minutes
  const ALERT_INTERVAL_MS = (parseInt(process.env.ALERT_CHECK_INTERVAL_MINUTES) || 30) * 60 * 1000;
  setInterval(() => { checkAllRules().catch(e => logger.error('Alert check error', { error: e.message })); }, ALERT_INTERVAL_MS);
  logger.info(`Alert engine started (interval: ${ALERT_INTERVAL_MS / 60000} min)`);

  // License check every 6 hours
  setInterval(() => {
    checkAllLicenses().catch(e => logger.error('License check error', { error: e.message }));
  }, 6 * 60 * 60 * 1000);
  // Run once at startup
  checkAllLicenses().catch(() => {});
}
