import * as svc from '../../services/cost.service.js';
import * as cfgSvc from './cost-config.service.js';
import * as pieceSvc from './piece-cost.service.js';

const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

export const byOrder = wrap(async (req, res) => {
  const r = await svc.calculateOrderCost(req.params.orderId);
  if (!r) return res.status(404).json({ message: 'Comanda negasita.' });
  res.json(r);
});

export const byProduct = wrap(async (req, res) => {
  const r = await svc.getCostByProduct(req.params.productId);
  if (!r) return res.status(404).json({ message: 'Produs negasit.' });
  res.json(r);
});

export const byMachine = wrap(async (req, res) => {
  const { dateFrom, dateTo, machineId } = req.query;
  if (!dateFrom || !dateTo) return res.status(400).json({ message: 'dateFrom si dateTo sunt obligatorii.' });
  res.json(await svc.getCostByMachine({ dateFrom, dateTo, machineId }));
});

export const byOperator = wrap(async (req, res) => {
  const { dateFrom, dateTo, userId } = req.query;
  if (!dateFrom || !dateTo) return res.status(400).json({ message: 'dateFrom si dateTo sunt obligatorii.' });
  res.json(await svc.getCostByOperator({ dateFrom, dateTo, userId }));
});

export const profitability = wrap(async (req, res) => {
  const { clientName, dateFrom, dateTo } = req.query;
  if (!dateFrom || !dateTo) return res.status(400).json({ message: 'dateFrom si dateTo sunt obligatorii.' });
  res.json(await svc.getProfitability({ clientName, dateFrom, dateTo }));
});

export const snapshot = wrap(async (req, res) => {
  const r = await svc.saveSnapshot(req.params.orderId);
  if (!r) return res.status(404).json({ message: 'Comanda negasita.' });
  res.status(201).json(r);
});

export const listSnapshots = wrap(async (req, res) => {
  res.json(await svc.listSnapshots(req.query));
});

// Cost elements
export const listElements = wrap(async (req, res) => {
  const tenantId = req.user?.tenant_id;
  res.json(await cfgSvc.listElements(tenantId));
});

export const updateElement = wrap(async (req, res) => {
  const updated = await cfgSvc.updateElement(req.params.id, req.body);
  if (!updated) return res.status(404).json({ message: 'Element negasit.' });
  res.json(updated);
});

// Machine cost config
export const getMachineCostConfig = wrap(async (req, res) => {
  const config = await cfgSvc.getMachineCostConfig(req.params.machineId);
  if (!config) return res.status(404).json({ message: 'Configuratie negasita.' });
  res.json(config);
});

export const setMachineCostConfig = wrap(async (req, res) => {
  const result = await cfgSvc.setMachineCostConfig(req.params.machineId, req.body);
  res.status(201).json(result);
});

// Operator cost config
export const listOperatorConfigs = wrap(async (req, res) => {
  const tenantId = req.user?.tenant_id;
  res.json(await cfgSvc.listOperatorConfigs(tenantId));
});

export const setOperatorConfigs = wrap(async (req, res) => {
  const tenantId = req.user?.tenant_id;
  const result = await cfgSvc.setOperatorConfigs(tenantId, req.body);
  res.status(201).json(result);
});

// Overhead config
export const listOverhead = wrap(async (req, res) => {
  const tenantId = req.user?.tenant_id;
  res.json(await cfgSvc.listOverhead(tenantId));
});

export const createOverhead = wrap(async (req, res) => {
  const tenantId = req.user?.tenant_id;
  const result = await cfgSvc.createOverhead(tenantId, req.body);
  res.status(201).json(result);
});

export const updateOverhead = wrap(async (req, res) => {
  const updated = await cfgSvc.updateOverhead(req.params.id, req.body);
  if (!updated) return res.status(404).json({ message: 'Overhead negasit.' });
  res.json(updated);
});

export const deleteOverhead = wrap(async (req, res) => {
  const { default: db } = await import('../../config/db.js');
  await db('costs.overhead_config').where({ id: req.params.id }).delete();
  res.status(204).end();
});

// Cost calculations
export const calculatePieceCost = wrap(async (req, res) => {
  const tenantId = req.user?.tenant_id;
  const { machineId, operatorId, quantity } = req.query;
  const result = await pieceSvc.calculatePieceCost(req.params.productId, {
    machineId,
    operatorId,
    quantity: quantity ? parseInt(quantity) : 1,
    tenantId,
  });
  if (!result) return res.status(404).json({ message: 'Produs negasit.' });
  res.json(result);
});

export const calculateOrderCost = wrap(async (req, res) => {
  const tenantId = req.user?.tenant_id;
  const result = await pieceSvc.calculateOrderCostComplete(req.params.orderId, tenantId);
  if (!result) return res.status(404).json({ message: 'Comanda negasita.' });
  res.json(result);
});

export const calculateQuote = wrap(async (req, res) => {
  const tenantId = req.user?.tenant_id;
  const { productId, quantity = 1, sellingPrice, machineId, operatorId } = req.query;
  if (!productId) return res.status(400).json({ message: 'productId este obligatoriu.' });

  const qty = parseInt(quantity);
  const pieceCost = await pieceSvc.calculatePieceCost(productId, {
    machineId,
    operatorId,
    quantity: qty,
    tenantId,
  });
  if (!pieceCost) return res.status(404).json({ message: 'Produs negasit.' });

  const sp = parseFloat(sellingPrice) || 0;
  const totalCost = pieceCost.perPiece * qty;
  const revenue = sp * qty;
  const margin = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : null;

  res.json({
    productId,
    quantity: qty,
    sellingPricePerPiece: sp,
    pieceCost: pieceCost.perPiece,
    totalCost,
    revenue,
    margin: margin !== null ? Math.round(margin * 100) / 100 : null,
    breakdown: pieceCost,
  });
});
