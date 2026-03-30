import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as svc from '../../services/shipment.service.js';

const router = Router();
router.use(authenticate);

// ─── List shipments ────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { orderId, status, page, limit } = req.query;
    res.json(await svc.listShipments({ orderId, status, page, limit }));
  } catch (e) { next(e); }
});

// ─── Shipments for an order with progress ──────────────────────────────

router.get('/by-order/:orderId', async (req, res, next) => {
  try {
    res.json(await svc.getOrderShipments(req.params.orderId));
  } catch (e) { next(e); }
});

// ─── Create shipment ───────────────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    const data = { ...req.body, tenant_id: req.user?.tenantId };
    res.status(201).json(await svc.createShipment(data, req.user?.id));
  } catch (e) { next(e); }
});

// ─── Get shipment detail ───────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const shipment = await svc.getShipment(req.params.id);
    if (!shipment) return res.status(404).json({ message: 'Expeditia nu a fost gasita' });
    res.json(shipment);
  } catch (e) { next(e); }
});

// ─── Add package ───────────────────────────────────────────────────────

router.post('/:id/packages', async (req, res, next) => {
  try {
    res.status(201).json(await svc.addPackage(req.params.id, req.body));
  } catch (e) { next(e); }
});

// ─── Dispatch ──────────────────────────────────────────────────────────

router.post('/:id/dispatch', async (req, res, next) => {
  try {
    res.json(await svc.dispatch(req.params.id));
  } catch (e) { next(e); }
});

// ─── Confirm delivery ──────────────────────────────────────────────────

router.put('/:id/deliver', async (req, res, next) => {
  try {
    const { deliveredAt, confirmedBy } = req.body;
    res.json(await svc.confirmDelivery(req.params.id, { deliveredAt, confirmedBy }));
  } catch (e) { next(e); }
});

// ─── Cancel ────────────────────────────────────────────────────────────

router.put('/:id/cancel', async (req, res, next) => {
  try {
    res.json(await svc.cancel(req.params.id));
  } catch (e) { next(e); }
});

export default router;
