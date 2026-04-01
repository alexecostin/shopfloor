import db from '../config/db.js';
import * as shiftService from './shift.service.js';

export async function calculateMTBF(machineId, dateFrom, dateTo) {
  const stops = await db('production.stops')
    .where('machine_id', machineId)
    .where('started_at', '>=', dateFrom)
    .where('started_at', '<=', dateTo)
    .whereIn('category', ['defect_utilaj', 'Defect utilaj']);

  const defectCount = stops.length;
  if (defectCount === 0) return { mtbf: Infinity, defects: 0, operatingHours: 0 };

  // Get total available hours from shift config
  let totalHours = 0;
  const current = new Date(dateFrom);
  const end = new Date(dateTo);
  while (current <= end) {
    try {
      const { totalHours: dayHours } = await shiftService.getAvailableHours(machineId, current.toISOString().split('T')[0]);
      totalHours += dayHours;
    } catch {
      totalHours += 16; // fallback
    }
    current.setDate(current.getDate() + 1);
  }

  // Total stop hours from defects
  const stopHours = stops.reduce((sum, s) => {
    const dur = s.duration_minutes || ((s.ended_at ? new Date(s.ended_at) - new Date(s.started_at) : 0) / 60000);
    return sum + dur / 60;
  }, 0);

  const operatingHours = Math.max(0, totalHours - stopHours);
  return {
    mtbf: operatingHours / defectCount,
    defects: defectCount,
    operatingHours: Math.round(operatingHours * 10) / 10,
  };
}

export async function calculateMTTR(machineId, dateFrom, dateTo) {
  const repairs = await db('maintenance.requests')
    .where('machine_id', machineId)
    .where('status', 'done')
    .where('created_at', '>=', dateFrom)
    .where('created_at', '<=', dateTo)
    .whereNotNull('started_at')
    .whereNotNull('resolved_at');

  if (repairs.length === 0) return { mttr: 0, repairs: 0, totalRepairHours: 0 };

  const totalMinutes = repairs.reduce((sum, r) => {
    return sum + (new Date(r.resolved_at) - new Date(r.started_at)) / 60000;
  }, 0);

  return {
    mttr: Math.round(totalMinutes / repairs.length),
    repairs: repairs.length,
    totalRepairHours: Math.round((totalMinutes / 60) * 10) / 10,
  };
}

export async function calculateAvailability(machineId, dateFrom, dateTo) {
  let totalAvailable = 0;
  const current = new Date(dateFrom);
  const end = new Date(dateTo);
  while (current <= end) {
    try {
      const { totalHours } = await shiftService.getAvailableHours(machineId, current.toISOString().split('T')[0]);
      totalAvailable += totalHours;
    } catch {
      totalAvailable += 16;
    }
    current.setDate(current.getDate() + 1);
  }

  const [{ total }] = await db('production.stops')
    .where('machine_id', machineId)
    .where('started_at', '>=', dateFrom)
    .where('started_at', '<=', dateTo)
    .sum('duration_minutes as total');

  const stopHours = (Number(total) || 0) / 60;
  const availability = totalAvailable > 0 ? ((totalAvailable - stopHours) / totalAvailable) * 100 : 0;
  return {
    availability: Math.round(availability * 10) / 10,
    availableHours: Math.round(totalAvailable * 10) / 10,
    stopHours: Math.round(stopHours * 10) / 10,
  };
}

export async function calculateOEETrend(machineId, weeks = 12) {
  const trend = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const from = weekStart.toISOString().split('T')[0];
    const to = weekEnd.toISOString().split('T')[0];

    const { availability } = await calculateAvailability(machineId, from, to);

    // Performance: actual output vs theoretical max
    const [{ goodSum }] = await db('production.reports')
      .where('machine_id', machineId)
      .where('reported_at', '>=', from)
      .where('reported_at', '<=', to)
      .sum('good_pieces as goodSum');
    const [{ scrapSum }] = await db('production.reports')
      .where('machine_id', machineId)
      .where('reported_at', '>=', from)
      .where('reported_at', '<=', to)
      .sum('scrap_pieces as scrapSum');

    const good = Number(goodSum) || 0;
    const scrap = Number(scrapSum) || 0;
    const total = good + scrap;
    const quality = total > 0 ? (good / total) * 100 : 100;
    const performance = 85; // simplified — would need cycle time data for real calc

    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;

    trend.push({
      week: from,
      weekLabel: `S${weeks - i}`,
      oee: Math.round(oee * 10) / 10,
      availability: Math.round(availability * 10) / 10,
      performance: Math.round(performance * 10) / 10,
      quality: Math.round(quality * 10) / 10,
    });
  }
  return trend;
}

export async function getTopStopReasons(machineId, dateFrom, dateTo, limit = 5) {
  return db('production.stops')
    .where('machine_id', machineId)
    .where('started_at', '>=', dateFrom)
    .where('started_at', '<=', dateTo)
    .select('category')
    .sum('duration_minutes as total_minutes')
    .count('* as count')
    .groupBy('category')
    .orderBy('total_minutes', 'desc')
    .limit(limit);
}

export async function getMachineKPIDashboard(machineId, period = 'month') {
  const days = period === 'quarter' ? 90 : period === 'year' ? 365 : 30;
  const dateTo = new Date().toISOString().split('T')[0];
  const dateFrom = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const [mtbfData, mttrData, availData, trend, topStops] = await Promise.all([
    calculateMTBF(machineId, dateFrom, dateTo),
    calculateMTTR(machineId, dateFrom, dateTo),
    calculateAvailability(machineId, dateFrom, dateTo),
    calculateOEETrend(machineId, Math.min(12, Math.ceil(days / 7))),
    getTopStopReasons(machineId, dateFrom, dateTo),
  ]);

  const latestOEE = trend.length > 0 ? trend[trend.length - 1].oee : 0;

  return {
    mtbf: mtbfData,
    mttr: mttrData,
    availability: availData,
    oee: latestOEE,
    trend,
    topStopReasons: topStops,
    period,
    dateFrom,
    dateTo,
  };
}

export async function compareMachines(machineIds, period = 'month') {
  const results = [];
  for (const id of machineIds) {
    const kpi = await getMachineKPIDashboard(id, period);
    const machine = await db('machines.machines').where('id', id).first();
    results.push({ machineId: id, code: machine?.code, name: machine?.name, ...kpi });
  }
  return results;
}
