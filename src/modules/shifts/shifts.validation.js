import Joi from 'joi';

export const createDefinitionSchema = Joi.object({
  orgUnitId: Joi.string().uuid().required(),
  shiftName: Joi.string().max(50).required(),
  shiftCode: Joi.string().max(10).required(),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  crossesMidnight: Joi.boolean().optional(),
  breakMinutes: Joi.number().integer().min(0).max(120).optional(),
  sortOrder: Joi.number().integer().min(1).optional(),
});

export const updateDefinitionSchema = Joi.object({
  shiftName: Joi.string().max(50).optional(),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
  crossesMidnight: Joi.boolean().optional(),
  breakMinutes: Joi.number().integer().min(0).max(120).optional(),
  sortOrder: Joi.number().integer().min(1).optional(),
  isActive: Joi.boolean().optional(),
});

export const upsertWeeklySchema = Joi.object({
  orgUnitId: Joi.string().uuid().required(),
  schedule: Joi.array().items(Joi.object({
    dayOfWeek: Joi.number().integer().min(0).max(6).required(),
    shiftCodes: Joi.array().items(Joi.string()).required(),
  })).required(),
});

export const createExceptionSchema = Joi.object({
  orgUnitId: Joi.string().uuid().required(),
  exceptionDate: Joi.date().required(),
  exceptionType: Joi.string().valid('holiday', 'extra_shift', 'reduced', 'custom').required(),
  name: Joi.string().max(255).optional().allow('', null),
  activeShifts: Joi.array().items(Joi.string()).optional().default([]),
  overrideTimes: Joi.array().optional().allow(null),
  isRecurring: Joi.boolean().optional(),
});

export const updateExceptionSchema = Joi.object({
  name: Joi.string().max(255).optional().allow('', null),
  exceptionType: Joi.string().valid('holiday', 'extra_shift', 'reduced', 'custom').optional(),
  activeShifts: Joi.array().items(Joi.string()).optional(),
  overrideTimes: Joi.array().optional().allow(null),
  isRecurring: Joi.boolean().optional(),
});
