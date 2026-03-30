import * as service from '../../services/lookup.service.js';

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

function getTenantId(req) {
  return req.tenantFilter?.tenantId || null;
}

export const listTypes = wrap(async (req, res) => {
  res.json(await service.getAllTypes());
});

export const listValues = wrap(async (req, res) => {
  const { includeInactive, search } = req.query;
  let values = await service.getValues(getTenantId(req), req.params.lookupType, includeInactive === 'true');
  if (search) {
    const s = search.toLowerCase();
    values = values.filter(v => v.displayName.toLowerCase().includes(s) || v.code.toLowerCase().includes(s));
  }
  res.json(values);
});

export const createValue = wrap(async (req, res) => {
  const v = await service.createValue(getTenantId(req), req.params.lookupType, req.body);
  res.status(201).json(v);
});

export const updateValue = wrap(async (req, res) => {
  const v = await service.updateValue(getTenantId(req), req.params.lookupType, req.params.code, req.body);
  if (!v) return res.status(404).json({ message: 'Valoare negasita.' });
  res.json(v);
});

export const deactivateValue = wrap(async (req, res) => {
  await service.deactivateValue(getTenantId(req), req.params.lookupType, req.params.code);
  res.status(204).end();
});

export const resetType = wrap(async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(400).json({ message: 'Tenant necesar pentru reset.' });
  res.json(await service.resetToDefaults(tenantId, req.params.lookupType));
});
