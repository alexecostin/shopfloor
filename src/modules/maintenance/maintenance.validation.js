import Joi from 'joi';

export const createRequestSchema = Joi.object({
  machineId: Joi.string().uuid().required().messages({ 'any.required': 'Utilajul este obligatoriu.' }),
  problemType: Joi.string().max(100).required().messages({ 'any.required': 'Tipul problemei este obligatoriu.' }),
  description: Joi.string().optional().allow('', null),
  priority: Joi.string().valid('low', 'normal', 'high', 'critical').optional(),
  photoUrl: Joi.string().max(500).uri().optional().allow('', null),
});

export const updateRequestSchema = Joi.object({
  assignedTo: Joi.string().uuid().optional().allow(null),
  priority: Joi.string().valid('low', 'normal', 'high', 'critical').optional(),
  status: Joi.string().valid('open', 'in_progress', 'done', 'cancelled').optional(),
  resolution: Joi.string().optional().allow('', null),
});
