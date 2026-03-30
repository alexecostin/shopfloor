import Joi from 'joi';

export const createValueSchema = Joi.object({
  code: Joi.string().max(100).required(),
  displayName: Joi.string().max(255).required(),
  displayNameEn: Joi.string().max(255).optional().allow('', null),
  sortOrder: Joi.number().integer().optional(),
  isDefault: Joi.boolean().optional(),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional().allow(null, ''),
  icon: Joi.string().max(50).optional().allow(null, ''),
  metadata: Joi.object().optional(),
});

export const updateValueSchema = Joi.object({
  displayName: Joi.string().max(255).optional(),
  displayNameEn: Joi.string().max(255).optional().allow('', null),
  sortOrder: Joi.number().integer().optional(),
  isDefault: Joi.boolean().optional(),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional().allow(null, ''),
  icon: Joi.string().max(50).optional().allow(null, ''),
  isActive: Joi.boolean().optional(),
  metadata: Joi.object().optional(),
});
