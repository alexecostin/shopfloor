import * as svc from './bom.service.js';

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
    const p = await svc.updateProduct(req.params.id, req.body);
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
