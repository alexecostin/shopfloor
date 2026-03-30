import * as svc from './admin.service.js';
import * as localeSvc from '../../services/locale.service.js';
import * as emailTplSvc from '../../services/email-templates.service.js';

const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
const tid = req => req.user?.tenantId || req.tenantFilter?.tenantId;

// Tenant
export const getTenant = wrap(async (req, res) => {
  const r = await svc.getCurrentTenant(tid(req));
  if (!r) return res.status(404).json({ message: 'Tenant negasit.' });
  res.json(r);
});
export const updateTenant = wrap(async (req, res) => res.json(await svc.updateTenant(tid(req), req.body)));
export const listTenants = wrap(async (req, res) => res.json(await svc.listTenants()));

// Modules
export const listModules = wrap(async (req, res) => res.json(await svc.listModules(tid(req))));
export const activateModule = wrap(async (req, res) => res.json(await svc.activateModule(tid(req), req.params.moduleCode)));
export const deactivateModule = wrap(async (req, res) => res.json(await svc.deactivateModule(tid(req), req.params.moduleCode)));
export const listAvailableModules = wrap(async (req, res) => {
  const tenant = await svc.getCurrentTenant(tid(req));
  res.json(svc.listAvailableModules(tenant?.tier || 'basic'));
});

// License
export const getLicense = wrap(async (req, res) => {
  const r = await svc.getLicense(tid(req));
  if (!r) return res.status(404).json({ message: 'Licenta negasita.' });
  res.json(r);
});
export const getLicenseUsage = wrap(async (req, res) => res.json(await svc.getLicenseUsage(tid(req))));

// Org
export const getOrgTree = wrap(async (req, res) => res.json(await svc.getOrgTree(tid(req))));
export const getOrgUnit = wrap(async (req, res) => {
  const r = await svc.getOrgUnit(tid(req), req.params.id);
  if (!r) return res.status(404).json({ message: 'Unitate negasita.' });
  res.json(r);
});
export const createOrgUnit = wrap(async (req, res) => res.status(201).json(await svc.createOrgUnit(tid(req), req.body)));
export const updateOrgUnit = wrap(async (req, res) => {
  const r = await svc.updateOrgUnit(tid(req), req.params.id, req.body);
  if (!r) return res.status(404).json({ message: 'Unitate negasita.' });
  res.json(r);
});
export const deleteOrgUnit = wrap(async (req, res) => {
  await svc.deleteOrgUnit(tid(req), req.params.id);
  res.json({ message: 'Sters.' });
});
export const listOrgTypes = wrap(async (req, res) => res.json(await svc.listOrgUnitTypes(tid(req))));
export const createOrgType = wrap(async (req, res) => res.status(201).json(await svc.createOrgUnitType(tid(req), req.body)));

// Roles
export const listRoles = wrap(async (req, res) => res.json(await svc.listRoles(tid(req))));
export const getRole = wrap(async (req, res) => {
  const r = await svc.getRole(req.params.id);
  if (!r) return res.status(404).json({ message: 'Rol negasit.' });
  res.json(r);
});
export const createRole = wrap(async (req, res) => res.status(201).json(await svc.createRole(tid(req), req.body)));
export const updateRole = wrap(async (req, res) => res.json(await svc.updateRole(req.params.id, req.body)));
export const deleteRole = wrap(async (req, res) => {
  await svc.deleteRole(req.params.id);
  res.json({ message: 'Sters.' });
});
export const listPermissions = wrap(async (req, res) => res.json(await svc.listPermissions()));
export const listPermissionsByModule = wrap(async (req, res) => res.json(await svc.listPermissionsByModule()));

// User management
export const setUserRoles = wrap(async (req, res) => res.json(await svc.setUserRoles(req.params.id, req.body.roleIds || [])));
export const setUserScopes = wrap(async (req, res) => res.json(await svc.setUserScopes(req.params.id, req.body.scopes || [])));
export const getEffectivePermissions = wrap(async (req, res) => res.json(await svc.getEffectivePermissions(req.params.id)));

// Locale / tenant settings
export const getSettings = wrap(async (req, res) => res.json(await localeSvc.getLocaleSettings(tid(req))));
export const updateSettings = wrap(async (req, res) => res.json(await localeSvc.updateLocaleSettings(tid(req), req.body)));
export const listTimezones = wrap(async (req, res) => res.json(localeSvc.listTimezones()));

// Email templates
export const listEmailTemplates = wrap(async (req, res) => {
  const templates = await emailTplSvc.listTemplates(tid(req));
  res.json({ templates, labels: emailTplSvc.TEMPLATE_LABELS });
});

export const upsertEmailTemplate = wrap(async (req, res) => {
  const { type, lang } = req.params;
  const { subject, body_html } = req.body;
  if (!subject || !body_html) return res.status(400).json({ message: 'subject si body_html sunt obligatorii' });
  res.json(await emailTplSvc.upsertTemplate(tid(req), type, lang, { subject, body_html }));
});

export const resetEmailTemplate = wrap(async (req, res) => {
  const { type, lang } = req.params;
  res.json(await emailTplSvc.resetTemplate(tid(req), type, lang));
});
