import * as svc from './inventory.service.js';

export const getItems = async (req, res, next) => {
  try { res.json(await svc.listItems(req.query)); } catch (e) { next(e); }
};

export const postItem = async (req, res, next) => {
  try {
    const item = await svc.createItem(req.body, req.user.id);
    res.status(201).json(item);
  } catch (e) { next(e); }
};

export const putItem = async (req, res, next) => {
  try {
    const item = await svc.updateItem(req.params.id, req.body);
    if (!item) return res.status(404).json({ message: 'Articol negasit.' });
    res.json(item);
  } catch (e) { next(e); }
};

export const getStockLevels = async (req, res, next) => {
  try { res.json(await svc.listStockLevels()); } catch (e) { next(e); }
};

export const getAlerts = async (req, res, next) => {
  try { res.json(await svc.getAlerts()); } catch (e) { next(e); }
};

export const getMovements = async (req, res, next) => {
  try { res.json(await svc.listMovements(req.query)); } catch (e) { next(e); }
};

export const postMovement = async (req, res, next) => {
  try {
    const m = await svc.createMovement(req.body, req.user.id);
    res.status(201).json(m);
  } catch (e) { next(e); }
};

export const getRequirements = async (req, res, next) => {
  try { res.json(await svc.listRequirements(req.query)); } catch (e) { next(e); }
};

export const postCalculateRequirements = async (req, res, next) => {
  try {
    const result = await svc.calculateRequirements(req.body.orderIds);
    res.json({ calculated: result.length, data: result });
  } catch (e) { next(e); }
};

export const getDocuments = async (req, res, next) => {
  try { res.json(await svc.listDocuments(req.query)); } catch (e) { next(e); }
};

export const getDocumentById = async (req, res, next) => {
  try {
    const doc = await svc.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document negasit.' });
    res.json(doc);
  } catch (e) { next(e); }
};

export const postDocument = async (req, res, next) => {
  try {
    const doc = await svc.createDocument(req.body, req.user.id);
    res.status(201).json(doc);
  } catch (e) { next(e); }
};

export const confirmDocument = async (req, res, next) => {
  try {
    const doc = await svc.confirmDocument(req.params.id, req.user.id);
    res.json(doc);
  } catch (e) { next(e); }
};

export const getDashboard = async (req, res, next) => {
  try { res.json(await svc.getDashboard()); } catch (e) { next(e); }
};
