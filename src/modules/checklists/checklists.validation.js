import Joi from 'joi';

export const createTemplateSchema = Joi.object({
  name: Joi.string().max(255).required().messages({ 'any.required': 'Numele template-ului este obligatoriu.' }),
  machineType: Joi.string().max(100).optional().allow('', null),
  items: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      text: Joi.string().required(),
      required: Joi.boolean().optional(),
    })
  ).min(1).required().messages({ 'any.required': 'Template-ul trebuie sa aiba cel putin un element.' }),
});

export const updateTemplateSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  machineType: Joi.string().max(100).optional().allow('', null),
  items: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      text: Joi.string().required(),
      required: Joi.boolean().optional(),
    })
  ).min(1).optional(),
  isActive: Joi.boolean().optional(),
});

export const completeChecklistSchema = Joi.object({
  templateId: Joi.string().uuid().required(),
  machineId: Joi.string().uuid().required(),
  shift: Joi.string().valid('Tura I', 'Tura II', 'Tura III').optional(),
  responses: Joi.array().items(
    Joi.object({
      itemId: Joi.string().required(),
      checked: Joi.boolean().required(),
      value: Joi.string().optional().allow('', null),
      note: Joi.string().optional().allow('', null),
    })
  ).min(1).required(),
});
