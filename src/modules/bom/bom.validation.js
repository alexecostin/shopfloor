import Joi from 'joi';

export const createProduct = Joi.object({
  reference: Joi.string().max(100).required(),
  name: Joi.string().max(255).required(),
  variant: Joi.string().max(100).allow('', null),
  clientName: Joi.string().max(255).allow('', null),
  clientPartNumber: Joi.string().max(100).allow('', null),
  productType: Joi.string().valid('raw_material', 'semi_finished', 'finished', 'component').default('finished'),
  containerType: Joi.string().max(100).allow('', null),
  qtyPerContainer: Joi.number().integer().min(1).allow(null),
  weightPieceKg: Joi.number().precision(4).allow(null),
  weightRunnerKg: Joi.number().precision(4).allow(null),
  materialType: Joi.string().max(100).allow('', null),
  notes: Joi.string().allow('', null),
  isActive: Joi.boolean().default(true),
});

export const updateProduct = createProduct.fork(
  ['reference', 'name'],
  (s) => s.optional()
);

export const createOperation = Joi.object({
  sequence: Joi.number().integer().min(1).required(),
  operationName: Joi.string().max(255).required(),
  operationType: Joi.string().max(100).allow('', null),
  machineType: Joi.string().max(100).allow('', null),
  machineId: Joi.string().uuid().allow(null),
  cycleTimeSeconds: Joi.number().precision(2).allow(null),
  nrCavities: Joi.number().integer().min(1).default(1),
  setupTimeMinutes: Joi.number().integer().min(0).default(0),
  description: Joi.string().allow('', null),
  isActive: Joi.boolean().default(true),
  cncProgram: Joi.string().max(255).allow('', null),
  rawMaterialSpec: Joi.string().allow('', null),
  toolsConfig: Joi.array().items(Joi.object()).default([]),
  machineParameters: Joi.array().items(Joi.object()).default([]),
  consumables: Joi.array().items(Joi.object()).default([]),
  attentionPoints: Joi.array().items(Joi.object()).default([]),
  minBatchBeforeNext: Joi.number().integer().min(1).allow(null),
  transferType: Joi.string().max(50).allow('', null),
  piecesPerHour: Joi.number().precision(2).allow(null),
});

export const createMaterial = Joi.object({
  materialName: Joi.string().max(255).required(),
  materialCode: Joi.string().max(100).allow('', null),
  materialType: Joi.string().max(100).allow('', null),
  qtyPerPiece: Joi.number().precision(6).positive().required(),
  unit: Joi.string().max(20).default('kg'),
  wasteFactor: Joi.number().precision(3).min(1).default(1.0),
  supplier: Joi.string().max(255).allow('', null),
  notes: Joi.string().allow('', null),
});

export const createComponent = Joi.object({
  componentProductId: Joi.string().uuid().allow(null),
  componentReference: Joi.string().max(100).allow('', null),
  componentName: Joi.string().max(255).allow('', null),
  qtyPerParent: Joi.number().precision(4).positive().default(1),
  notes: Joi.string().allow('', null),
});

export const createCostRate = Joi.object({
  rateType: Joi.string().valid('machine_hourly', 'labor_hourly', 'overhead', 'material').required(),
  referenceId: Joi.string().uuid().allow(null),
  referenceName: Joi.string().max(255).allow('', null),
  rateEurPerHour: Joi.number().precision(2).allow(null),
  rateEurPerUnit: Joi.number().precision(4).allow(null),
  validFrom: Joi.date().allow(null),
  validTo: Joi.date().allow(null),
  notes: Joi.string().allow('', null),
});
