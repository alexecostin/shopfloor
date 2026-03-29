import Joi from 'joi';

export const createItem = Joi.object({
  code: Joi.string().max(100).required(),
  name: Joi.string().max(255).required(),
  category: Joi.string().valid('raw_material', 'semi_finished', 'finished_good', 'consumable', 'packaging', 'spare_part', 'tool').required(),
  unit: Joi.string().max(20).default('buc'),
  productId: Joi.string().uuid().allow(null),
  supplierName: Joi.string().max(255).allow('', null),
  supplierCode: Joi.string().max(100).allow('', null),
  minStock: Joi.number().precision(2).min(0).default(0),
  maxStock: Joi.number().precision(2).allow(null),
  reorderQty: Joi.number().precision(2).allow(null),
  leadTimeDays: Joi.number().integer().allow(null),
  location: Joi.string().max(255).allow('', null),
  weightPerUnitKg: Joi.number().precision(4).allow(null),
  costPerUnit: Joi.number().precision(4).allow(null),
  isActive: Joi.boolean().default(true),
});

export const updateItem = createItem.fork(['code', 'name', 'category'], (s) => s.optional());

export const createMovement = Joi.object({
  itemId: Joi.string().uuid().required(),
  movementType: Joi.string().valid(
    'receipt', 'production_input', 'production_output', 'shipment',
    'adjustment_plus', 'adjustment_minus', 'scrap', 'return_supplier', 'transfer'
  ).required(),
  qty: Joi.number().precision(2).positive().required(),
  referenceType: Joi.string().max(50).allow('', null),
  referenceId: Joi.string().uuid().allow(null),
  referenceNumber: Joi.string().max(100).allow('', null),
  lotNumber: Joi.string().max(100).allow('', null),
  supplierName: Joi.string().max(255).allow('', null),
  unitCost: Joi.number().precision(4).allow(null),
  location: Joi.string().max(255).allow('', null),
  notes: Joi.string().allow('', null),
});

export const createDocument = Joi.object({
  documentType: Joi.string().valid('receipt_note', 'issue_note', 'transfer_note', 'return_note').required(),
  partnerName: Joi.string().max(255).allow('', null),
  lines: Joi.array().items(Joi.object({
    itemId: Joi.string().uuid().required(),
    qty: Joi.number().precision(2).positive().required(),
    unitCost: Joi.number().precision(4).allow(null),
    lotNumber: Joi.string().max(100).allow('', null),
    notes: Joi.string().allow('', null),
  })).min(1).required(),
  notes: Joi.string().allow('', null),
});

export const calculateRequirements = Joi.object({
  orderIds: Joi.array().items(Joi.string().uuid()).allow(null),
});
