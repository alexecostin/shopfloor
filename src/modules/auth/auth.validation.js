import Joi from 'joi';

export const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Adresa de email este invalida.',
    'any.required': 'Emailul este obligatoriu.',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Parola trebuie sa aiba cel putin 8 caractere.',
    'any.required': 'Parola este obligatorie.',
  }),
});

export const registerSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Adresa de email este invalida.',
    'any.required': 'Emailul este obligatoriu.',
  }),
  password: Joi.string()
    .min(8)
    .pattern(/[A-Z]/, 'majuscula')
    .pattern(/[0-9]/, 'cifra')
    .required()
    .messages({
      'string.min': 'Parola trebuie sa aiba cel putin 8 caractere.',
      'string.pattern.name': 'Parola trebuie sa contina cel putin o {#name}.',
      'any.required': 'Parola este obligatorie.',
    }),
  fullName: Joi.string().min(2).max(255).required().messages({
    'any.required': 'Numele complet este obligatoriu.',
  }),
  role: Joi.string()
    .valid('admin', 'production_manager', 'shift_leader', 'operator', 'maintenance')
    .required()
    .messages({
      'any.only': 'Rolul ales este invalid.',
      'any.required': 'Rolul este obligatoriu.',
    }),
  badgeNumber: Joi.string().max(50).optional().allow(''),
  phone: Joi.string().max(50).optional().allow(''),
});

export const updateUserSchema = Joi.object({
  fullName: Joi.string().min(2).max(255).optional(),
  role: Joi.string()
    .valid('admin', 'production_manager', 'shift_leader', 'operator', 'maintenance')
    .optional(),
  badgeNumber: Joi.string().max(50).optional().allow(''),
  phone: Joi.string().max(50).optional().allow(''),
  isActive: Joi.boolean().optional(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Parola curenta este obligatorie.',
  }),
  newPassword: Joi.string()
    .min(8)
    .pattern(/[A-Z]/, 'majuscula')
    .pattern(/[0-9]/, 'cifra')
    .required()
    .messages({
      'string.min': 'Parola noua trebuie sa aiba cel putin 8 caractere.',
      'string.pattern.name': 'Parola noua trebuie sa contina cel putin o {#name}.',
      'any.required': 'Parola noua este obligatorie.',
    }),
});
