import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as svc from '../../services/barcode.service.js';

const router = Router();
router.use(authenticate);

router.post('/generate', async (req, res, next) => {
  try {
    const { entityType, entityId, label, barcodeType } = req.body;
    if (!entityType || !entityId) return res.status(400).json({ message: 'entityType si entityId obligatorii' });
    res.status(201).json(await svc.generate(entityType, entityId, label, req.user?.tenantId, barcodeType));
  } catch (e) { next(e); }
});

router.post('/generate-batch', async (req, res, next) => {
  try {
    const { entityType, items } = req.body;
    res.status(201).json(await svc.generateBatch(entityType, items, req.user?.tenantId));
  } catch (e) { next(e); }
});

router.get('/lookup/:value', async (req, res, next) => {
  try {
    const result = await svc.lookup(req.params.value);
    if (!result) return res.status(404).json({ message: 'Cod necunoscut' });
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/associate', async (req, res, next) => {
  try {
    const { barcodeValue, entityType, entityId } = req.body;
    res.json(await svc.associate(barcodeValue, entityType, entityId, req.user?.tenantId));
  } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await svc.listBarcodes({ entityType: req.query.entityType, tenantId: req.user?.tenantId }));
  } catch (e) { next(e); }
});

export default router;
