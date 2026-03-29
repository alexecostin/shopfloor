import Joi from 'joi';

export const createMasterPlan = Joi.object({
  name: Joi.string().max(255).required(),
  planType: Joi.string().valid('weekly', 'monthly').default('weekly'),
  weekNumber: Joi.number().integer().min(1).max(53).allow(null),
  year: Joi.number().integer().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(),
  notes: Joi.string().allow('', null),
});

export const updateMasterPlan = Joi.object({
  name: Joi.string().max(255),
  status: Joi.string().valid('draft', 'active', 'closed', 'cancelled'),
  revision: Joi.number().integer(),
  notes: Joi.string().allow('', null),
});

export const createAllocation = Joi.object({
  masterPlanId: Joi.string().uuid().required(),
  planDate: Joi.date().required(),
  shift: Joi.string().valid('Tura I', 'Tura II', 'Tura III').required(),
  machineId: Joi.string().uuid().required(),
  productId: Joi.string().uuid().allow(null),
  productReference: Joi.string().max(100).allow('', null),
  productName: Joi.string().max(255).allow('', null),
  orderId: Joi.string().uuid().allow(null),
  plannedQty: Joi.number().integer().min(0).default(0),
  plannedHours: Joi.number().precision(2).allow(null),
  notes: Joi.string().allow('', null),
});

export const bulkAllocations = Joi.object({
  masterPlanId: Joi.string().uuid().required(),
  allocations: Joi.array().items(Joi.object({
    planDate: Joi.date().required(),
    shift: Joi.string().required(),
    machineId: Joi.string().uuid().required(),
    productReference: Joi.string().allow('', null),
    productName: Joi.string().allow('', null),
    plannedQty: Joi.number().integer().min(0).default(0),
    plannedHours: Joi.number().precision(2).allow(null),
  })).min(1).required(),
});

export const updateAllocation = Joi.object({
  plannedQty: Joi.number().integer().min(0),
  realizedQty: Joi.number().integer().min(0),
  scrapQty: Joi.number().integer().min(0),
  status: Joi.string().valid('planned', 'in_progress', 'completed', 'cancelled'),
  notes: Joi.string().allow('', null),
});

export const createDemand = Joi.object({
  clientName: Joi.string().max(255).allow('', null),
  productId: Joi.string().uuid().allow(null),
  productReference: Joi.string().max(100).required(),
  demandDate: Joi.date().required(),
  requiredQty: Joi.number().integer().positive().required(),
  deliveryDate: Joi.date().allow(null),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
  notes: Joi.string().allow('', null),
});

export const bulkDemands = Joi.object({
  demands: Joi.array().items(Joi.object({
    clientName: Joi.string().allow('', null),
    productReference: Joi.string().required(),
    demandDate: Joi.date().required(),
    requiredQty: Joi.number().integer().positive().required(),
    deliveryDate: Joi.date().allow(null),
  })).min(1).required(),
});
