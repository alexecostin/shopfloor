import Joi from 'joi';

export const createOrderSchema = Joi.object({
  orderNumber: Joi.string().max(100).required().messages({ 'any.required': 'Numarul comenzii este obligatoriu.' }),
  productName: Joi.string().max(255).required().messages({ 'any.required': 'Numele produsului este obligatoriu.' }),
  productCode: Joi.string().max(100).optional().allow(''),
  machineId: Joi.string().uuid().required().messages({ 'any.required': 'Utilajul este obligatoriu.' }),
  targetQuantity: Joi.number().integer().min(1).required().messages({ 'any.required': 'Cantitatea tinta este obligatorie.' }),
  status: Joi.string().valid('planned', 'active', 'completed', 'cancelled').optional(),
});

export const updateOrderSchema = Joi.object({
  productName: Joi.string().max(255).optional(),
  productCode: Joi.string().max(100).optional().allow(''),
  machineId: Joi.string().uuid().optional(),
  targetQuantity: Joi.number().integer().min(1).optional(),
  status: Joi.string().valid('planned', 'active', 'completed', 'cancelled').optional(),
});

export const createReportSchema = Joi.object({
  orderId: Joi.string().uuid().optional().allow(null),
  machineId: Joi.string().uuid().required().messages({ 'any.required': 'Utilajul este obligatoriu.' }),
  shift: Joi.string().min(1).max(50).required().messages({ 'any.required': 'Tura este obligatorie.' }),
  goodPieces: Joi.number().integer().min(0).required().messages({ 'any.required': 'Numarul de piese bune este obligatoriu.' }),
  scrapPieces: Joi.number().integer().min(0).optional().default(0),
  scrapReason: Joi.string().max(255).optional().allow('', null),
  notes: Joi.string().optional().allow('', null),
});

export const createStopSchema = Joi.object({
  machineId: Joi.string().uuid().required().messages({ 'any.required': 'Utilajul este obligatoriu.' }),
  reason: Joi.string().max(255).required().messages({ 'any.required': 'Motivul opririi este obligatoriu.' }),
  category: Joi.string().max(100).optional().allow('', null),
  shift: Joi.string().min(1).max(50).optional(),
  notes: Joi.string().optional().allow('', null),
});

export const closeStopSchema = Joi.object({
  notes: Joi.string().optional().allow('', null),
});

export const createShiftSchema = Joi.object({
  shiftName: Joi.string().min(1).max(50).required(),
  date: Joi.date().optional(),
  notesIncoming: Joi.string().optional().allow('', null),
});

export const closeShiftSchema = Joi.object({
  notesOutgoing: Joi.string().optional().allow('', null),
});
