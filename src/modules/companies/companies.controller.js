import * as svc from './companies.service.js';

export const getCompanies = async (req, res, next) => {
  try { res.json(await svc.listCompanies(req.query)); } catch (e) { next(e); }
};

export const getCompanyById = async (req, res, next) => {
  try {
    const c = await svc.getCompany(req.params.id);
    if (!c) return res.status(404).json({ message: 'Companie negasita.' });
    res.json(c);
  } catch (e) { next(e); }
};

export const postCompany = async (req, res, next) => {
  try {
    const c = await svc.createCompany(req.body);
    res.status(201).json(c);
  } catch (e) { next(e); }
};

export const putCompany = async (req, res, next) => {
  try {
    const c = await svc.updateCompany(req.params.id, req.body);
    if (!c) return res.status(404).json({ message: 'Companie negasita.' });
    res.json(c);
  } catch (e) { next(e); }
};

export const deleteCompany = async (req, res, next) => {
  try {
    const c = await svc.softDeleteCompany(req.params.id);
    if (!c) return res.status(404).json({ message: 'Companie negasita.' });
    res.json({ message: 'Dezactivata.' });
  } catch (e) { next(e); }
};

export const getContacts = async (req, res, next) => {
  try { res.json(await svc.listContacts(req.params.companyId)); } catch (e) { next(e); }
};

export const postContact = async (req, res, next) => {
  try {
    const c = await svc.createContact(req.params.companyId, req.body);
    res.status(201).json(c);
  } catch (e) { next(e); }
};

export const putContact = async (req, res, next) => {
  try {
    const c = await svc.updateContact(req.params.id, req.body);
    if (!c) return res.status(404).json({ message: 'Contact negasit.' });
    res.json(c);
  } catch (e) { next(e); }
};

export const deleteContact = async (req, res, next) => {
  try {
    await svc.deleteContact(req.params.id);
    res.json({ message: 'Sters.' });
  } catch (e) { next(e); }
};
