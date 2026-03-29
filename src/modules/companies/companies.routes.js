import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as v from './companies.validation.js';
import * as c from './companies.controller.js';

const router = Router();
const mgr = authorize('admin', 'production_manager');
const adm = authorize('admin');

router.use(authenticate);

router.get('/', c.getCompanies);
router.get('/:id', c.getCompanyById);
router.post('/', mgr, validate(v.createCompany), c.postCompany);
router.put('/:id', mgr, validate(v.updateCompany), c.putCompany);
router.delete('/:id', adm, c.deleteCompany);

router.get('/:companyId/contacts', c.getContacts);
router.post('/:companyId/contacts', mgr, validate(v.createContact), c.postContact);
router.put('/contacts/:id', mgr, validate(v.updateContact), c.putContact);
router.delete('/contacts/:id', adm, c.deleteContact);

export default router;
