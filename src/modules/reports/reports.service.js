import db from '../../config/db.js';

// Helper: get ISO week string from date
function isoWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const wk = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
}

export async function getByProduct({ dateFrom, dateTo, productId }) {
  // Realized from production.reports joined with production.orders
  let realQuery = db('production.reports as r')
    .join('production.orders as o', 'r.order_id', 'o.id')
    .leftJoin('bom.products as bp', 'o.product_code', 'bp.reference')
    .select(
      'o.product_code',
      'o.product_name',
      db.raw('COALESCE(bp.id::text, o.product_code) as product_key'),
      db.raw('SUM(r.good_pieces) as realized'),
      db.raw('SUM(r.scrap_pieces) as scrap')
    )
    .whereBetween('r.reported_at', [dateFrom, dateTo])
    .groupBy('o.product_code', 'o.product_name', 'bp.id');

  if (productId) {
    realQuery = realQuery.where('bp.id', productId);
  }
  const realized = await realQuery;

  // Planned from planning.daily_allocations
  let planQuery = db('planning.daily_allocations as da')
    .join('bom.products as bp', 'da.product_id', 'bp.id')
    .select(
      'bp.id as product_id',
      'bp.reference as product_code',
      'bp.name as product_name',
      db.raw('SUM(da.planned_quantity) as planned')
    )
    .whereBetween('da.date', [dateFrom, dateTo])
    .groupBy('bp.id', 'bp.reference', 'bp.name');

  if (productId) {
    planQuery = planQuery.where('bp.id', productId);
  }
  const planned = await planQuery;

  // Merge
  const map = {};
  for (const p of planned) {
    map[p.product_code] = { product_code: p.product_code, product_name: p.product_name, planned: Number(p.planned), realized: 0, scrap: 0 };
  }
  for (const r of realized) {
    const key = r.product_code;
    if (!map[key]) map[key] = { product_code: key, product_name: r.product_name, planned: 0, realized: 0, scrap: 0 };
    map[key].realized = Number(r.realized);
    map[key].scrap = Number(r.scrap);
  }

  const rows = Object.values(map).map(row => ({
    ...row,
    diff_abs: row.realized - row.planned,
    diff_pct: row.planned > 0 ? Number(((row.realized - row.planned) / row.planned * 100).toFixed(1)) : null,
    scrap_rate_pct: (row.realized + row.scrap) > 0 ? Number((row.scrap / (row.realized + row.scrap) * 100).toFixed(2)) : 0,
  }));

  // Trend grouping if date range > 7 days
  const days = (new Date(dateTo) - new Date(dateFrom)) / 86400000;
  let trend = null;
  if (days > 7 && productId) {
    const trendRows = await db('production.reports as r')
      .join('production.orders as o', 'r.order_id', 'o.id')
      .leftJoin('bom.products as bp', 'o.product_code', 'bp.reference')
      .select(db.raw('date_trunc(\'week\', r.reported_at)::date as week_start'), db.raw('SUM(r.good_pieces) as realized'), db.raw('SUM(r.scrap_pieces) as scrap'))
      .where('bp.id', productId)
      .whereBetween('r.reported_at', [dateFrom, dateTo])
      .groupBy(db.raw('date_trunc(\'week\', r.reported_at)::date'))
      .orderBy('week_start');
    trend = trendRows.map(r => ({ week: isoWeek(r.week_start), realized: Number(r.realized), scrap: Number(r.scrap) }));
  }

  return { rows, trend };
}

export async function getByMachine({ date, dateFrom, dateTo }) {
  const from = dateFrom || date || new Date().toISOString().split('T')[0];
  const to = dateTo || date || from;

  const rows = await db('production.reports as r')
    .join('machines.machines as m', 'r.machine_id', 'm.id')
    .leftJoin('production.orders as o', 'r.order_id', 'o.id')
    .leftJoin('planning.daily_allocations as da', function() {
      this.on('da.machine_id', '=', 'r.machine_id')
        .andOn(db.raw('da.date = date(r.reported_at)'))
        .andOn('da.shift', '=', 'r.shift');
    })
    .select(
      'm.id as machine_id', 'm.code as machine_code', 'm.name as machine_name',
      db.raw('COALESCE(o.product_code, \'\') as product_code'),
      db.raw('COALESCE(o.product_name, \'\') as product_name'),
      'r.shift',
      db.raw('date(r.reported_at) as date'),
      db.raw('SUM(da.planned_quantity) as planned'),
      db.raw('SUM(r.good_pieces) as realized'),
      db.raw('SUM(r.scrap_pieces) as scrap')
    )
    .whereBetween(db.raw('date(r.reported_at)'), [from, to])
    .groupBy('m.id', 'm.code', 'm.name', db.raw('o.product_code'), db.raw('o.product_name'), 'r.shift', db.raw('date(r.reported_at)'))
    .orderBy(['m.code', 'date', 'r.shift']);

  return rows.map(r => ({
    ...r,
    planned: Number(r.planned || 0),
    realized: Number(r.realized || 0),
    scrap: Number(r.scrap || 0),
  }));
}

export async function getByOrder(orderId) {
  const order = await db('production.orders').where('id', orderId).first();
  if (!order) return null;

  const daily = await db('production.reports')
    .select(db.raw('date(reported_at) as date'), db.raw('SUM(good_pieces) as pieces'), db.raw('SUM(scrap_pieces) as scrap'))
    .where('order_id', orderId)
    .groupBy(db.raw('date(reported_at)'))
    .orderBy('date');

  const totalRealized = daily.reduce((s, r) => s + Number(r.pieces), 0);
  const totalScrap = daily.reduce((s, r) => s + Number(r.scrap), 0);
  const progress = order.target_quantity > 0 ? Number((totalRealized / order.target_quantity * 100).toFixed(1)) : 0;

  // Estimate completion: avg pieces/day × remaining pieces
  let estimatedCompletion = null;
  if (daily.length >= 2 && totalRealized < order.target_quantity) {
    const avgPerDay = totalRealized / daily.length;
    if (avgPerDay > 0) {
      const remaining = order.target_quantity - totalRealized;
      const daysLeft = Math.ceil(remaining / avgPerDay);
      const est = new Date();
      est.setDate(est.getDate() + daysLeft);
      estimatedCompletion = est.toISOString().split('T')[0];
    }
  }

  return {
    order,
    progress_pct: progress,
    total_realized: totalRealized,
    total_scrap: totalScrap,
    target_quantity: order.target_quantity,
    estimated_completion: estimatedCompletion,
    daily_breakdown: daily.map(r => ({ date: r.date, pieces: Number(r.pieces), scrap: Number(r.scrap) })),
  };
}

export async function getByOperator({ dateFrom, dateTo, userId }) {
  let q = db('production.reports as r')
    .join('auth.users as u', 'r.operator_id', 'u.id')
    .select(
      'u.id as user_id', 'u.full_name',
      db.raw('SUM(r.good_pieces) as total_realized'),
      db.raw('SUM(r.scrap_pieces) as total_scrap'),
      db.raw('COUNT(DISTINCT date(r.reported_at)) as days_worked')
    )
    .whereBetween('r.reported_at', [dateFrom, dateTo])
    .groupBy('u.id', 'u.full_name');

  if (userId) q = q.where('r.operator_id', userId);

  const rows = await q;

  // Compute productivity (pieces per day as proxy for pieces/hour since we don't have hours)
  const avg_realized = rows.length > 0 ? rows.reduce((s, r) => s + Number(r.total_realized), 0) / rows.length : 0;

  return rows.map(r => ({
    ...r,
    total_realized: Number(r.total_realized),
    total_scrap: Number(r.total_scrap),
    days_worked: Number(r.days_worked),
    pieces_per_day: r.days_worked > 0 ? Number((Number(r.total_realized) / Number(r.days_worked)).toFixed(1)) : 0,
    scrap_rate_pct: (Number(r.total_realized) + Number(r.total_scrap)) > 0
      ? Number((Number(r.total_scrap) / (Number(r.total_realized) + Number(r.total_scrap)) * 100).toFixed(2)) : 0,
    vs_avg_pct: avg_realized > 0 ? Number(((Number(r.total_realized) - avg_realized) / avg_realized * 100).toFixed(1)) : 0,
  }));
}

export async function getWeeklySummary(weekStart) {
  // weekStart = 'YYYY-MM-DD' (Monday)
  const d = new Date(weekStart);
  const weekEnd = new Date(d);
  weekEnd.setDate(d.getDate() + 6);
  const from = d.toISOString().split('T')[0];
  const to = weekEnd.toISOString().split('T')[0];

  const production = await db('production.reports as r')
    .join('machines.machines as m', 'r.machine_id', 'm.id')
    .leftJoin('production.orders as o', 'r.order_id', 'o.id')
    .select(
      'm.id as machine_id', 'm.code as machine_code', 'm.name as machine_name',
      db.raw('COALESCE(o.product_code, \'\') as product_code'),
      db.raw('COALESCE(o.product_name, \'\') as product_name'),
      db.raw('SUM(r.good_pieces) as realized'),
      db.raw('SUM(r.scrap_pieces) as scrap')
    )
    .whereBetween(db.raw('date(r.reported_at)'), [from, to])
    .groupBy('m.id', 'm.code', 'm.name', db.raw('o.product_code'), db.raw('o.product_name'));

  // Stops (downtime)
  const stops = await db('production.stops as s')
    .join('machines.machines as m', 's.machine_id', 'm.id')
    .select('m.id as machine_id', db.raw('SUM(s.duration_minutes) as total_stop_minutes'))
    .whereBetween(db.raw('date(s.started_at)'), [from, to])
    .whereNotNull('s.duration_minutes')
    .groupBy('m.id');

  const stopsMap = {};
  for (const s of stops) stopsMap[s.machine_id] = Number(s.total_stop_minutes);

  // Planned
  const planned = await db('planning.daily_allocations as da')
    .join('machines.machines as m', 'da.machine_id', 'm.id')
    .leftJoin('bom.products as bp', 'da.product_id', 'bp.id')
    .select(
      'm.id as machine_id',
      db.raw('COALESCE(bp.reference, \'\') as product_code'),
      db.raw('SUM(da.planned_quantity) as planned')
    )
    .whereBetween('da.date', [from, to])
    .groupBy('m.id', db.raw('bp.reference'));

  const plannedMap = {};
  for (const p of planned) {
    const k = `${p.machine_id}:${p.product_code}`;
    plannedMap[k] = Number(p.planned);
  }

  const rows = production.map(r => {
    const k = `${r.machine_id}:${r.product_code}`;
    return {
      machine_code: r.machine_code,
      machine_name: r.machine_name,
      product_code: r.product_code,
      product_name: r.product_name,
      planned: plannedMap[k] || 0,
      realized: Number(r.realized),
      scrap: Number(r.scrap),
      stop_minutes: stopsMap[r.machine_id] || 0,
    };
  });

  const total_realized = rows.reduce((s, r) => s + r.realized, 0);
  const total_planned = rows.reduce((s, r) => s + r.planned, 0);
  const total_scrap = rows.reduce((s, r) => s + r.scrap, 0);

  return {
    week_start: from,
    week_end: to,
    rows,
    summary: {
      total_planned,
      total_realized,
      total_scrap,
      efficiency_pct: total_planned > 0 ? Number((total_realized / total_planned * 100).toFixed(1)) : null,
      scrap_rate_pct: (total_realized + total_scrap) > 0 ? Number((total_scrap / (total_realized + total_scrap) * 100).toFixed(2)) : 0,
    },
  };
}

export async function getTrend({ productId, machineId, weeks = 8 }) {
  const weeksAgo = new Date();
  weeksAgo.setDate(weeksAgo.getDate() - weeks * 7);
  const dateFrom = weeksAgo.toISOString().split('T')[0];

  let q = db('production.reports as r')
    .select(
      db.raw('date_trunc(\'week\', r.reported_at)::date as week_start'),
      db.raw('SUM(r.good_pieces) as realized'),
      db.raw('SUM(r.scrap_pieces) as scrap')
    )
    .where(db.raw('r.reported_at >= ?', [dateFrom]))
    .groupBy(db.raw('date_trunc(\'week\', r.reported_at)::date'))
    .orderBy('week_start');

  if (productId) {
    q = q.join('production.orders as o', 'r.order_id', 'o.id')
         .join('bom.products as bp', 'o.product_code', 'bp.reference')
         .where('bp.id', productId);
  }
  if (machineId) {
    q = q.where('r.machine_id', machineId);
  }

  const realized = await q;

  // Planned per week
  let planQ = db('planning.daily_allocations as da')
    .select(
      db.raw('date_trunc(\'week\', da.date::timestamp)::date as week_start'),
      db.raw('SUM(da.planned_quantity) as planned')
    )
    .where(db.raw('da.date >= ?', [dateFrom]))
    .groupBy(db.raw('date_trunc(\'week\', da.date::timestamp)::date'))
    .orderBy('week_start');

  if (productId) planQ = planQ.where('da.product_id', productId);
  if (machineId) planQ = planQ.where('da.machine_id', machineId);

  const plannedRows = await planQ;
  const plannedMap = {};
  for (const p of plannedRows) plannedMap[p.week_start?.toISOString().split('T')[0]] = Number(p.planned);

  return realized.map(r => ({
    week: isoWeek(r.week_start),
    week_start: r.week_start,
    planned: plannedMap[r.week_start?.toISOString().split('T')[0]] || 0,
    realized: Number(r.realized),
    scrap: Number(r.scrap),
  }));
}

export async function getMonthComparison({ month, year }) {
  const m = parseInt(month);
  const y = parseInt(year);
  const curFrom = `${y}-${String(m).padStart(2, '0')}-01`;
  const curTo = new Date(y, m, 0).toISOString().split('T')[0];
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  const prevFrom = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
  const prevTo = new Date(prevY, prevM, 0).toISOString().split('T')[0];

  async function getMachineStats(from, to) {
    return db('production.reports as r')
      .join('machines.machines as m', 'r.machine_id', 'm.id')
      .select(
        'm.id as machine_id', 'm.code as machine_code', 'm.name as machine_name',
        db.raw('SUM(r.good_pieces) as realized'),
        db.raw('SUM(r.scrap_pieces) as scrap')
      )
      .whereBetween(db.raw('date(r.reported_at)'), [from, to])
      .groupBy('m.id', 'm.code', 'm.name');
  }

  const [cur, prev] = await Promise.all([getMachineStats(curFrom, curTo), getMachineStats(prevFrom, prevTo)]);

  const prevMap = {};
  for (const r of prev) prevMap[r.machine_id] = r;

  const rows = cur.map(r => {
    const p = prevMap[r.machine_id] || { realized: 0, scrap: 0 };
    const curR = Number(r.realized);
    const prevR = Number(p.realized);
    return {
      machine_code: r.machine_code,
      machine_name: r.machine_name,
      current_realized: curR,
      current_scrap: Number(r.scrap),
      prev_realized: prevR,
      prev_scrap: Number(p.scrap),
      change_pct: prevR > 0 ? Number(((curR - prevR) / prevR * 100).toFixed(1)) : null,
    };
  });

  return {
    current_month: `${year}-${String(month).padStart(2, '0')}`,
    previous_month: `${prevY}-${String(prevM).padStart(2, '0')}`,
    rows,
  };
}

// Saved reports CRUD
export async function listSavedReports() {
  return db('reports.saved_reports').orderBy('created_at', 'desc');
}

export async function createSavedReport(data, userId) {
  const [row] = await db('reports.saved_reports').insert({ ...data, created_by: userId }).returning('*');
  return row;
}

export async function deleteSavedReport(id) {
  const n = await db('reports.saved_reports').where('id', id).delete();
  return n > 0;
}
