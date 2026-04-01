import Joi from 'joi';

const VALID_COMPANY_TYPES = ['client', 'supplier', 'prospect', 'both'];

export const createCompany = Joi.object({
  name: Joi.string().max(255).required(),
  // Accept either legacy singular or new array form; neither is strictly required
  companyType: Joi.string().valid(...VALID_COMPANY_TYPES).optional(),
  companyTypes: Joi.array().items(Joi.string().valid(...VALID_COMPANY_TYPES)).optional(),
  fiscalCode: Joi.string().max(50).allow('', null),
  tradeRegister: Joi.string().max(50).allow('', null),
  address: Joi.string().allow('', null),
  city: Joi.string().max(100).allow('', null),
  country: Joi.string().max(100).allow('', null), // default applied from tenant config in service layer
  phone: Joi.string().max(50).allow('', null),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null),
  website: Joi.string().max(255).allow('', null),
  paymentTermsDays: Joi.number().integer().min(0).allow(null), // default applied from tenant config in service layer
  notes: Joi.string().allow('', null),
  isActive: Joi.boolean().default(true),
});

export const updateCompany = createCompany.fork(['name'], (s) => s.optional());

export const createContact = Joi.object({
  // Accept both 'name' and 'fullName' for convenience
  name: Joi.string().max(255).optional(),
  fullName: Joi.string().max(255).optional(),
  role: Joi.string().max(100).allow('', null),
  phone: Joi.string().max(50).allow('', null),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null),
  isPrimary: Joi.boolean().default(false),
  notes: Joi.string().allow('', null),
  relationshipType: Joi.string().valid('client_contact', 'supplier_contact', 'internal', 'other').optional(),
  contextTags: Joi.array().items(Joi.string()).optional(),
  department: Joi.string().max(100).allow('', null).optional(),
}).or('name', 'fullName');

export const updateContact = Joi.object({
  name: Joi.string().max(255).optional(),
  fullName: Joi.string().max(255).optional(),
  role: Joi.string().max(100).allow('', null),
  phone: Joi.string().max(50).allow('', null),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null),
  isPrimary: Joi.boolean().optional(),
  notes: Joi.string().allow('', null),
  relationshipType: Joi.string().valid('client_contact', 'supplier_contact', 'internal', 'other').optional(),
  contextTags: Joi.array().items(Joi.string()).optional(),
  department: Joi.string().max(100).allow('', null).optional(),
});
