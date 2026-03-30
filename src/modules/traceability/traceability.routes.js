import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as svc from '../../services/traceability.service.js';

const router = Router();
router.use(authenticate);

// ─── Lots ───────────────────────────────────────────────────────────────

router.get('/lots', async (req, res, next) => {
  try {
    const { itemId, status, page, limit } = req.query;
    res.json(await svc.listLots({ itemId, status, page, limit }));
  } catch (e) { next(e); }
});

router.post('/lots', async (req, res, next) => {
  try {
    const { lot_number, item_id, supplier_id, received_date, expiry_date, quantity, unit } = req.body;
    if (!lot_number) return res.status(400).json({ message: 'lot_number obligatoriu' });
    res.status(201).json(await svc.createLot({
      ...req.body,
      tenant_id: req.user?.tenantId,
    }));
  } catch (e) { next(e); }
});

router.get('/lots/:id', async (req, res, next) => {
  try {
    const lot = await svc.getLot(req.params.id);
    if (!lot) return res.status(404).json({ message: 'Lot negasit' });
    res.json(lot);
  } catch (e) { next(e); }
});

router.post('/lots/:id/usage', async (req, res, next) => {
  try {
    const { production_report_id, quantity_used } = req.body;
    if (!production_report_id || !quantity_used) {
      return res.status(400).json({ message: 'production_report_id si quantity_used obligatorii' });
    }
    res.status(201).json(await svc.recordLotUsage(production_report_id, req.params.id, quantity_used));
  } catch (e) { next(e); }
});

// ─── Serials ────────────────────────────────────────────────────────────

router.get('/serials', async (req, res, next) => {
  try {
    const { productId, orderId, page, limit } = req.query;
    res.json(await svc.listSerials({ productId, orderId, page, limit }));
  } catch (e) { next(e); }
});

router.post('/serials/generate', async (req, res, next) => {
  try {
    const { product_id, production_report_id, order_id, count, format } = req.body;
    if (!count || count < 1) return res.status(400).json({ message: 'count obligatoriu (min 1)' });
    res.status(201).json(await svc.generateSerialNumbers(product_id, production_report_id, order_id, count, format));
  } catch (e) { next(e); }
});

// ─── Trace ──────────────────────────────────────────────────────────────

router.get('/forward/lot/:lotId', async (req, res, next) => {
  try {
    const result = await svc.forwardTrace(req.params.lotId);
    if (!result) return res.status(404).json({ message: 'Lot negasit' });
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/backward/order/:orderId', async (req, res, next) => {
  try {
    const result = await svc.backwardTrace(req.params.orderId);
    if (!result) return res.status(404).json({ message: 'Comanda negasita' });
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/backward/serial/:serialNumber', async (req, res, next) => {
  try {
    const result = await svc.backwardTraceSerial(req.params.serialNumber);
    if (!result) return res.status(404).json({ message: 'Serial negasit' });
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
