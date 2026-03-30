import * as kpiService from '../../services/machine-kpi.service.js';

export async function getDashboard(req, res, next) {
  try {
    const { period } = req.query;
    const data = await kpiService.getMachineKPIDashboard(req.params.id, period || 'month');
    res.json(data);
  } catch (err) { next(err); }
}

export async function getTrend(req, res, next) {
  try {
    const weeks = req.query.weeks ? Number(req.query.weeks) : 12;
    const data = await kpiService.calculateOEETrend(req.params.id, weeks);
    res.json(data);
  } catch (err) { next(err); }
}

export async function comparison(req, res, next) {
  try {
    const { machineIds, period } = req.query;
    if (!machineIds) return res.status(400).json({ error: 'machineIds query param required' });
    const ids = String(machineIds).split(',').map(Number).filter(Boolean);
    if (ids.length === 0) return res.status(400).json({ error: 'No valid machine IDs' });
    const data = await kpiService.compareMachines(ids, period || 'month');
    res.json(data);
  } catch (err) { next(err); }
}
