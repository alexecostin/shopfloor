import Joi from 'joi';

export const createCompany = Joi.object({
  name: Joi.string().max(255).required(),
  companyType: Joi.string().valid('client', 'supplier', 'prospect', 'both').required(),
  fiscalCode: Joi.string().max(50).allow('', null),
  tradeRegister: Joi.string().max(50).allow('', null),
  address: Joi.string().allow('', null),
  city: Joi.string().max(100).allow('', null),
  country: Joi.string().max(100).default('Romania'),
  phone: Joi.string().max(50).allow('', null),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null),
  website: Joi.string().max(255).allow('', null),
  paymentTermsDays: Joi.number().integer().min(0).default(30),
  notes: Joi.string().allow('', null),
  isActive: Joi.boolean().default(true),
});

export const updateCompany = createCompany.fork(['name', 'companyType'], (s) => s.optional());

export const createContact = Joi.object({
  fullName: Joi.string().max(255).required(),
  role: Joi.string().max(100).allow('', null),
  phone: Joi.string().max(50).allow('', null),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null),
  isPrimary: Joi.boolean().default(false),
  notes: Joi.string().allow('', null),
});

export const updateContact = createContact.fork(['fullName'], (s) => s.optional());
