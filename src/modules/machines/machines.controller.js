import * as service from './machines.service.js';

export async function list(req, res, next) {
  try {
    const { status, type, search, page, limit } = req.query;
    const result = await service.listMachines({
      status, type, search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
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
    const machine = await service.createMachine(req.body);
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
