import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as svc from '../../services/purchasing.service.js';

const router = Router();
const mgr = authorize('admin', 'production_manager', 'logistics');

router.use(authenticate);

// ── Purchase Orders ──────────────────────────────────────────────────────────

// List POs
router.get('/orders', async (req, res, next) => {
  try {
    const { status, supplierId, page, limit } = req.query;
    res.json(await svc.listPOs({
      status,
      supplierId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
    }));
  } catch (e) { next(e); }
});

// Create PO
router.post('/orders', mgr, async (req, res, next) => {
  try {
    const po = await svc.createPO(req.body, req.user.userId);
    res.status(201).json(po);
  } catch (e) { next(e); }
});

// Get PO detail with lines + receipts
router.get('/orders/:id', async (req, res, next) => {
  try {
    res.json(await svc.getPO(req.params.id));
  } catch (e) { next(e); }
});

// Update PO header
router.put('/orders/:id', mgr, async (req, res, next) => {
  try {
    res.json(await svc.updatePO(req.params.id, req.body));
  } catch (e) { next(e); }
});

// ── Lines ────────────────────────────────────────────────────────────────────

// Add line
router.post('/orders/:id/lines', mgr, async (req, res, next) => {
  try {
    const line = await svc.addLine(req.params.id, req.body);
    res.status(201).json(line);
  } catch (e) { next(e); }
});

// Update line
router.put('/orders/lines/:lineId', mgr, async (req, res, next) => {
  try {
    res.json(await svc.updateLine(req.params.lineId, req.body));
  } catch (e) { next(e); }
});

// Delete line
router.delete('/orders/lines/:lineId', mgr, async (req, res, next) => {
  try {
    await svc.removeLine(req.params.lineId);
    res.status(204).send();
  } catch (e) { next(e); }
});

// ── Status transitions ───────────────────────────────────────────────────────

// Send PO
router.post('/orders/:id/send', mgr, async (req, res, next) => {
  try {
    res.json(await svc.sendPO(req.params.id));
  } catch (e) { next(e); }
});

// Confirm PO (supplier confirms)
router.put('/orders/:id/confirm', mgr, async (req, res, next) => {
  try {
    res.json(await svc.confirmPO(req.params.id, req.body));
  } catch (e) { next(e); }
});

// Receive lines
router.post('/orders/:id/receive', mgr, async (req, res, next) => {
  try {
    res.json(await svc.receiveLines(req.params.id, req.body.receipts, req.user.userId));
  } catch (e) { next(e); }
});

// Cancel PO
router.put('/orders/:id/cancel', mgr, async (req, res, next) => {
  try {
    res.json(await svc.cancelPO(req.params.id));
  } catch (e) { next(e); }
});

// ── Deficit items ────────────────────────────────────────────────────────────

router.get('/deficit-items', async (req, res, next) => {
  try {
    res.json(await svc.getDeficitItems());
  } catch (e) { next(e); }
});

export default router;
