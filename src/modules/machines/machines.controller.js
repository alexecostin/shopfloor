import * as service from './machines.service.js';

export async function list(req, res, next) {
  try {
    const { status, type, search, page, limit } = req.query;
    const result = await service.listMachines({
      status, type, search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    }, req);
    res.json(result);
  } catch (err) { next(err); }
}

export async function get(req, res, next) {
  try {
    const machine = await service.getMachine(req.params.id);
    res.json(machine);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const machine = await service.createMachine(req.body, req);
    res.status(201).json(machine);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const machine = await service.updateMachine(req.params.id, req.body);
    res.json(machine);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    await service.deleteMachine(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function assignOperator(req, res, next) {
  try {
    await service.assignOperator(req.params.id, req.body.userId);
    res.status(201).json({ message: 'Operator asignat cu succes.' });
  } catch (err) { next(err); }
}

export async function removeOperator(req, res, next) {
  try {
    await service.removeOperator(req.params.id, req.params.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

// Groups
export const listGroups = async (req, res, next) => {
  try { res.json(await service.listGroups(req)); } catch (e) { next(e); }
};
export const getGroup = async (req, res, next) => {
  try {
    const g = await service.getGroup(req.params.id);
    if (!g) return res.status(404).json({ message: 'Grupa negasita.' });
    res.json(g);
  } catch (e) { next(e); }
};
export const createGroup = async (req, res, next) => {
  try { res.status(201).json(await service.createGroup(req.body, req)); } catch (e) { next(e); }
};
export const updateGroup = async (req, res, next) => {
  try { res.json(await service.updateGroup(req.params.id, req.body)); } catch (e) { next(e); }
};
export const addMachineToGroup = async (req, res, next) => {
  try { res.json(await service.addMachineToGroup(req.params.id, req.body.machineId)); } catch (e) { next(e); }
};
export const removeMachineFromGroup = async (req, res, next) => {
  try { await service.removeMachineFromGroup(req.params.id, req.params.machineId); res.json({ message: 'Sters.' }); } catch (e) { next(e); }
};

// Capabilities
export const listCapabilities = async (req, res, next) => {
  try { res.json(await service.listCapabilities(req.params.id)); } catch (e) { next(e); }
};
export const addCapability = async (req, res, next) => {
  try { res.status(201).json(await service.addCapability(req.params.id, req.body)); } catch (e) { next(e); }
};
export const updateCapability = async (req, res, next) => {
  try { res.json(await service.updateCapability(req.params.id, req.body)); } catch (e) { next(e); }
};
export const deleteCapability = async (req, res, next) => {
  try { await service.deleteCapability(req.params.id); res.json({ message: 'Sters.' }); } catch (e) { next(e); }
};

// Planning view
export const getMachinePlanning = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    res.json(await service.getMachinePlanning(req.params.id, dateFrom, dateTo));
  } catch (e) { next(e); }
};
