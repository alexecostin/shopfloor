import Joi from 'joi';

export const createMachineSchema = Joi.object({
  code: Joi.string().max(50).required().messages({
    'any.required': 'Codul utilajului este obligatoriu.',
  }),
  name: Joi.string().max(255).required().messages({
    'any.required': 'Numele utilajului este obligatoriu.',
  }),
  type: Joi.string().max(100).required().messages({
    'any.required': 'Tipul utilajului este obligatoriu.',
  }),
  location: Joi.string().max(255).optional().allow(''),
  status: Joi.string().valid('active', 'maintenance', 'inactive').optional(),
  metadata: Joi.object().optional(),
});

export const updateMachineSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  type: Joi.string().max(100).optional(),
  location: Joi.string().max(255).optional().allow(''),
  status: Joi.string().valid('active', 'maintenance', 'inactive').optional(),
  metadata: Joi.object().optional(),
});

export const assignOperatorSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'any.required': 'ID-ul operatorului este obligatoriu.',
    'string.guid': 'ID-ul operatorului trebuie sa fie un UUID valid.',
  }),
});
