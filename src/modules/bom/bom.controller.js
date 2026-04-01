import * as svc from './bom.service.js';
import * as templateSvc from '../../services/operation-templates.service.js';

export const getProducts = async (req, res, next) => {
  try {
    const result = await svc.listProducts(req.query);
    res.json(result);
  } catch (e) { next(e); }
};

export const getProductById = async (req, res, next) => {
  try {
    const p = await svc.getProduct(req.params.id);
    if (!p) return res.status(404).json({ message: 'Produs negasit.' });
    res.json(p);
  } catch (e) { next(e); }
};

export const postProduct = async (req, res, next) => {
  try {
    const p = await svc.createProduct(req.body);
    res.status(201).json(p);
  } catch (e) { next(e); }
};

export const putProduct = async (req, res, next) => {
  try {
    const p = await svc.updateProduct(req.params.id, req.body, {
      tenantId: req.user?.tenantId,
      userId: req.user?.userId,
    });
    if (!p) return res.status(404).json({ message: 'Produs negasit.' });
    res.json(p);
  } catch (e) { next(e); }
};

export const getOperations = async (req, res, next) => {
  try {
    res.json(await svc.listOperations(req.params.productId));
  } catch (e) { next(e); }
};

export const postOperation = async (req, res, next) => {
  try {
    const op = await svc.createOperation(req.params.productId, req.body);
    res.status(201).json(op);
  } catch (e) { next(e); }
};

export const putOperation = async (req, res, next) => {
  try {
    const op = await svc.updateOperation(req.params.id, req.body);
    if (!op) return res.status(404).json({ message: 'Operatie negasita.' });
    res.json(op);
  } catch (e) { next(e); }
};

export const deleteOperation = async (req, res, next) => {
  try {
    await svc.deleteOperation(req.params.id);
    res.json({ message: 'Sters.' });
  } catch (e) { next(e); }
};

export const getMaterials = async (req, res, next) => {
  try {
    res.json(await svc.listMaterials(req.params.productId));
  } catch (e) { next(e); }
};

export const postMaterial = async (req, res, next) => {
  try {
    const m = await svc.createMaterial(req.params.productId, req.body);
    res.status(201).json(m);
  } catch (e) { next(e); }
};

export const putMaterial = async (req, res, next) => {
  try {
    const m = await svc.updateMaterial(req.params.id, req.body);
    if (!m) return res.status(404).json({ message: 'Material negasit.' });
    res.json(m);
  } catch (e) { next(e); }
};

export const deleteMaterial = async (req, res, next) => {
  try {
    await svc.deleteMaterial(req.params.id);
    res.json({ message: 'Sters.' });
  } catch (e) { next(e); }
};

export const getComponents = async (req, res, next) => {
  try {
    res.json(await svc.listComponents(req.params.productId));
  } catch (e) { next(e); }
};

export const postComponent = async (req, res, next) => {
  try {
    const c = await svc.createComponent(req.params.productId, req.body);
    res.status(201).json(c);
  } catch (e) { next(e); }
};

export const putComponent = async (req, res, next) => {
  try {
    const c = await svc.updateComponent(req.params.id, req.body);
    if (!c) return res.status(404).json({ message: 'Componenta negasita.' });
    res.json(c);
  } catch (e) { next(e); }
};

export const getCostRates = async (req, res, next) => {
  try {
    res.json(await svc.listCostRates());
  } catch (e) { next(e); }
};

export const postCostRate = async (req, res, next) => {
  try {
    const r = await svc.createCostRate(req.body);
    res.status(201).json(r);
  } catch (e) { next(e); }
};

export const getProductCost = async (req, res, next) => {
  try {
    const cost = await svc.calculateCost(req.params.id);
    if (!cost) return res.status(404).json({ message: 'Produs negasit.' });
    res.json(cost);
  } catch (e) { next(e); }
};

export const getProductDependencies = async (req, res, next) => {
  try {
    res.json(await svc.getProductDependencies(req.params.productId));
  } catch (e) { next(e); }
};

export const addDependency = async (req, res, next) => {
  try {
    const r = await svc.addDependency(req.params.operationId, req.body);
    res.status(201).json(r);
  } catch (e) { next(e); }
};

export const removeDependency = async (req, res, next) => {
  try {
    await svc.removeDependency(req.params.id);
    res.json({ message: 'Sters.' });
  } catch (e) { next(e); }
};

export const getBackwardSchedule = async (req, res, next) => {
  try {
    const { deadline, quantity } = req.query;
    if (!deadline || !quantity) return res.status(400).json({ message: 'deadline si quantity sunt obligatorii.' });
    res.json(await svc.getBackwardSchedule(req.params.productId, deadline, quantity));
  } catch (e) { next(e); }
};

// ─── MBOM for Work Order ─────────────────────────────────────────────────────

export const getMBOMForOrder = async (req, res, next) => {
  try {
    const result = await svc.getMBOMForOrder(req.params.orderId);
    if (!result) return res.status(404).json({ message: 'Comanda de lucru negasita.' });
    res.json(result);
  } catch (e) { next(e); }
};

// ─── Operation Alternatives ──────────────────────────────────────────────────

export const postAlternative = async (req, res, next) => {
  try {
    const alt = await svc.addAlternative(req.params.operationId, req.body);
    res.status(201).json(alt);
  } catch (e) { next(e); }
};

export const deleteAlternative = async (req, res, next) => {
  try {
    await svc.removeAlternative(req.params.id);
    res.json({ message: 'Sters.' });
  } catch (e) { next(e); }
};

// ─── Validate MBOM ──────────────────────────────────────────────────────────

export const validateMBOM = async (req, res, next) => {
  try {
    const product = await svc.validateMBOM(req.params.productId);
    if (!product) return res.status(404).json({ message: 'Produs negasit.' });
    res.json(product);
  } catch (e) { next(e); }
};

// ─── Copy MBOM ──────────────────────────────────────────────────────────────

export const copyMBOM = async (req, res, next) => {
  try {
    const result = await svc.copyMBOMFromProduct(req.params.sourceId, req.params.targetId);
    res.json(result);
  } catch (e) { next(e); }
};

// ─── Operation Templates ────────────────────────────────────────────────────

export const getTemplates = async (req, res, next) => {
  try {
    res.json(await templateSvc.listTemplates(req.user?.tenantId));
  } catch (e) { next(e); }
};

export const postTemplate = async (req, res, next) => {
  try {
    const tpl = await templateSvc.createTemplate(req.body, req.user?.tenantId);
    res.status(201).json(tpl);
  } catch (e) { next(e); }
};

export const deleteTemplate = async (req, res, next) => {
  try {
    await templateSvc.deleteTemplate(req.params.id);
    res.json({ message: 'Template sters.' });
  } catch (e) { next(e); }
};
