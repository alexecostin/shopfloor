import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as svc from '../../services/framework-contract.service.js';

const router = Router();
const mgr = authorize('admin', 'production_manager', 'commercial');

router.use(authenticate);

// List framework contracts
router.get('/', async (req, res, next) => {
  try {
    const { status, tenantId } = req.query;
    res.json(await svc.listContracts(tenantId || null, status || null));
  } catch (e) { next(e); }
});

// Create framework contract
router.post('/', mgr, async (req, res, next) => {
  try {
    const contract = await svc.createContract(req.body);
    res.status(201).json(contract);
  } catch (e) { next(e); }
});

// Get contract detail with linked orders
router.get('/:id', async (req, res, next) => {
  try {
    const contract = await svc.getContract(req.params.id);
    if (!contract) return res.status(404).json({ message: 'Contract negasit.' });
    res.json(contract);
  } catch (e) { next(e); }
});

// Update contract
router.put('/:id', mgr, async (req, res, next) => {
  try {
    const contract = await svc.updateContract(req.params.id, req.body);
    if (!contract) return res.status(404).json({ message: 'Contract negasit.' });
    res.json(contract);
  } catch (e) { next(e); }
});

// Generate next delivery order from contract
router.post('/:id/generate-delivery', mgr, async (req, res, next) => {
  try {
    const wo = await svc.generateNextDelivery(req.params.id, req.user.userId);
    if (!wo) return res.status(400).json({ message: 'Nu s-a putut genera livrarea.' });
    res.status(201).json(wo);
  } catch (e) { next(e); }
});

export default router;
