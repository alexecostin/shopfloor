import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as c from './admin.controller.js';
import multer from 'multer';
import * as themeService from './theme.service.js';

const router = Router();
router.use(authenticate);
const admin = authorize('admin');

const upload = multer({
  limits: { fileSize: 500 * 1024 }, // 500KB
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/svg+xml'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tip fisier invalid. Acceptat: jpg, png, svg'));
  }
});

// Tenant
router.get('/tenant', c.getTenant);
router.put('/tenant', admin, c.updateTenant);
router.get('/tenants', admin, c.listTenants); // super-admin

// Modules
router.get('/modules', c.listModules);
router.get('/modules/available', c.listAvailableModules);
router.post('/modules/:moduleCode/activate', admin, c.activateModule);
router.post('/modules/:moduleCode/deactivate', admin, c.deactivateModule);

// License
router.get('/license', c.getLicense);
router.get('/license/usage', c.getLicenseUsage);

// Org
router.get('/org', c.getOrgTree);
router.get('/org/types', c.listOrgTypes);
router.post('/org/types', admin, c.createOrgType);
router.get('/org/:id', c.getOrgUnit);
router.post('/org', admin, c.createOrgUnit);
router.put('/org/:id', admin, c.updateOrgUnit);
router.delete('/org/:id', admin, c.deleteOrgUnit);

// Roles
router.get('/permissions/by-module', c.listPermissionsByModule);
router.get('/permissions', c.listPermissions);
router.get('/roles', c.listRoles);
router.post('/roles', admin, c.createRole);
router.get('/roles/:id', c.getRole);
router.put('/roles/:id', admin, c.updateRole);
router.delete('/roles/:id', admin, c.deleteRole);

// User management
router.put('/users/:id/roles', admin, c.setUserRoles);
router.put('/users/:id/scopes', admin, c.setUserScopes);
router.get('/users/:id/effective-permissions', c.getEffectivePermissions);

// Locale / tenant settings
router.get('/settings', c.getSettings);
router.put('/settings', admin, c.updateSettings);
router.get('/settings/timezones', c.listTimezones);

// Email templates
router.get('/email-templates', c.listEmailTemplates);
router.put('/email-templates/:type/:lang', admin, c.upsertEmailTemplate);
router.delete('/email-templates/:type/:lang', admin, c.resetEmailTemplate);

// Theme
router.get('/theme', async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId;
    res.json(await themeService.getTheme(tenantId));
  } catch (e) { next(e); }
});

router.put('/theme', admin, async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant necunoscut' });
    res.json(await themeService.upsertTheme(tenantId, req.body));
  } catch (e) { next(e); }
});

router.post('/theme/logo', admin, upload.single('logo'), async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant necunoscut' });
    if (!req.file) return res.status(400).json({ error: 'Fisier lipsa' });
    const logoType = req.body.logoType || 'main';
    const url = await themeService.saveLogo(tenantId, req.file.buffer, req.file.mimetype, logoType);
    res.json({ url });
  } catch (e) { next(e); }
});

export default router;
