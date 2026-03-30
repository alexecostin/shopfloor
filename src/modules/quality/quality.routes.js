import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as svc from '../../services/quality.service.js';

const router = Router();
router.use(authenticate);

// ═══════════════════════════════════════════════════════════════════════
// MEASUREMENT PLANS
// ═══════════════════════════════════════════════════════════════════════

router.get('/plans', async (req, res, next) => {
  try {
    const { productId, isActive, page, limit } = req.query;
    res.json(await svc.listPlans({ productId, isActive, page, limit }));
  } catch (e) { next(e); }
});

router.post('/plans', async (req, res, next) => {
  try {
    res.status(201).json(await svc.createPlan({
      ...req.body,
      tenant_id: req.user?.tenantId,
      created_by: req.user?.userId,
    }));
  } catch (e) { next(e); }
});

router.get('/plans/:id', async (req, res, next) => {
  try {
    res.json(await svc.getPlan(req.params.id));
  } catch (e) { next(e); }
});

router.put('/plans/:id', async (req, res, next) => {
  try {
    res.json(await svc.updatePlan(req.params.id, req.body));
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════
// MEASUREMENTS
// ═══════════════════════════════════════════════════════════════════════

router.get('/measurements', async (req, res, next) => {
  try {
    const { planId, orderId, measurementType, result, page, limit } = req.query;
    res.json(await svc.listMeasurements({ planId, orderId, measurementType, result, page, limit }));
  } catch (e) { next(e); }
});

router.post('/measurements', async (req, res, next) => {
  try {
    res.status(201).json(await svc.createMeasurement({
      ...req.body,
      operator_id: req.body.operator_id || req.user?.userId,
      tenant_id: req.user?.tenantId,
    }));
  } catch (e) { next(e); }
});

router.get('/measurements/:id', async (req, res, next) => {
  try {
    res.json(await svc.getMeasurement(req.params.id));
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════
// FIRST ARTICLE INSPECTION
// ═══════════════════════════════════════════════════════════════════════

router.post('/fai', async (req, res, next) => {
  try {
    res.status(201).json(await svc.createFAI({
      ...req.body,
      operator_id: req.body.operator_id || req.user?.userId,
      tenant_id: req.user?.tenantId,
    }));
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════
// SPC
// ═══════════════════════════════════════════════════════════════════════

router.get('/spc', async (req, res, next) => {
  try {
    const { productId, characteristic } = req.query;
    res.json(await svc.calculateSPC(productId, characteristic));
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════
// NCR
// ═══════════════════════════════════════════════════════════════════════

router.get('/ncr', async (req, res, next) => {
  try {
    const { status, severity, ncrType, page, limit } = req.query;
    res.json(await svc.listNCR({ status, severity, ncrType, page, limit }));
  } catch (e) { next(e); }
});

router.post('/ncr', async (req, res, next) => {
  try {
    res.status(201).json(await svc.createNCR({
      ...req.body,
      reported_by: req.body.reported_by || req.user?.userId,
      tenant_id: req.user?.tenantId,
    }));
  } catch (e) { next(e); }
});

router.get('/ncr/:id', async (req, res, next) => {
  try {
    res.json(await svc.getNCR(req.params.id));
  } catch (e) { next(e); }
});

router.put('/ncr/:id', async (req, res, next) => {
  try {
    res.json(await svc.updateNCR(req.params.id, req.body));
  } catch (e) { next(e); }
});

router.put('/ncr/:id/close', async (req, res, next) => {
  try {
    res.json(await svc.closeNCR(req.params.id, req.body));
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════
// CAPA
// ═══════════════════════════════════════════════════════════════════════

router.get('/capa', async (req, res, next) => {
  try {
    const { ncrId, status, capaType, page, limit } = req.query;
    res.json(await svc.listCAPA({ ncrId, status, capaType, page, limit }));
  } catch (e) { next(e); }
});

router.post('/capa', async (req, res, next) => {
  try {
    res.status(201).json(await svc.createCAPA({
      ...req.body,
      tenant_id: req.user?.tenantId,
    }));
  } catch (e) { next(e); }
});

router.put('/capa/:id', async (req, res, next) => {
  try {
    res.json(await svc.updateCAPA(req.params.id, req.body));
  } catch (e) { next(e); }
});

router.put('/capa/:id/verify', async (req, res, next) => {
  try {
    res.json(await svc.verifyCAPA(req.params.id, {
      ...req.body,
      verified_by: req.body.verified_by || req.user?.userId,
    }));
  } catch (e) { next(e); }
});

export default router;
