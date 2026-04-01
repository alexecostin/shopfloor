import db from '../config/db.js';

const PLANS   = 'quality.measurement_plans';
const MEAS    = 'quality.measurements';
const SPC     = 'quality.spc_data';
const NCR     = 'quality.ncr';
const CAPA    = 'quality.capa';

// ── helpers ──────────────────────────────────────────────────────────────
function notFound(message, code) {
  const err = new Error(message);
  err.statusCode = 404;
  err.code = code;
  return err;
}

function badRequest(message, code) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

// ════════════════════════════════════════════════════════════════════════
// MEASUREMENT PLANS
// ════════════════════════════════════════════════════════════════════════

export async function listPlans({ productId, isActive, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  let query = db(PLANS);

  if (productId) query = query.where({ product_id: productId });
  if (isActive !== undefined && isActive !== '') {
    query = query.where({ is_active: isActive === 'true' || isActive === true });
  }

  const [{ count }] = await query.clone().count('id as count');
  const data = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

  return { data, pagination: { page: Number(page), limit: Number(limit), total: Number(count), pages: Math.ceil(count / limit) } };
}

export async function getPlan(id) {
  const plan = await db(PLANS).where({ id }).first();
  if (!plan) throw notFound('Planul de masurare nu a fost gasit.', 'PLAN_NEGASIT');
  return plan;
}

export async function createPlan(body) {
  const { product_id, plan_name, characteristics, sampling_rule, is_active, tenant_id, created_by } = body;
  if (!plan_name) throw badRequest('plan_name obligatoriu.', 'PLAN_NAME_LIPSA');

  // Accept both JSON string and array for characteristics
  let parsedChars = characteristics || [];
  if (typeof parsedChars === 'string') {
    try { parsedChars = JSON.parse(parsedChars); } catch { parsedChars = []; }
  }

  const [plan] = await db(PLANS).insert({
    product_id: product_id || null,
    plan_name,
    characteristics: JSON.stringify(parsedChars),
    sampling_rule: sampling_rule ? (typeof sampling_rule === 'string' ? sampling_rule : JSON.stringify(sampling_rule)) : null,
    is_active: is_active !== false,
    tenant_id: tenant_id || null,
    created_by: created_by || null,
  }).returning('*');

  return plan;
}

export async function updatePlan(id, body) {
  await getPlan(id); // ensure exists

  const updates = {};
  if (body.plan_name !== undefined) updates.plan_name = body.plan_name;
  if (body.product_id !== undefined) updates.product_id = body.product_id;
  if (body.characteristics !== undefined) updates.characteristics = JSON.stringify(body.characteristics);
  if (body.sampling_rule !== undefined) updates.sampling_rule = JSON.stringify(body.sampling_rule);
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  if (Object.keys(updates).length === 0) return getPlan(id);

  const [updated] = await db(PLANS).where({ id }).update(updates).returning('*');
  return updated;
}

// ════════════════════════════════════════════════════════════════════════
// MEASUREMENTS
// ════════════════════════════════════════════════════════════════════════

/**
 * Auto-check tolerances for each measured value against plan characteristics.
 * Returns array of value objects with added `result` field (pass/fail).
 */
function evaluateValues(measuredValues, characteristics) {
  return measuredValues.map(mv => {
    const charDef = characteristics.find(c => c.name === mv.name);
    if (!charDef) return { ...mv, result: 'pass' }; // unknown characteristic, skip

    const nominal = Number(charDef.nominal);
    const upper = nominal + Number(charDef.upper_tolerance || 0);
    const lower = nominal - Math.abs(Number(charDef.lower_tolerance || 0));
    const measured = Number(mv.measured);

    const pass = measured >= lower && measured <= upper;
    return { ...mv, result: pass ? 'pass' : 'fail', nominal, upper, lower };
  });
}

export async function listMeasurements({ planId, orderId, measurementType, result, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  let query = db(MEAS);

  if (planId) query = query.where({ plan_id: planId });
  if (orderId) query = query.where({ order_id: orderId });
  if (measurementType) query = query.where({ measurement_type: measurementType });
  if (result) query = query.where({ overall_result: result });

  const [{ count }] = await query.clone().count('id as count');
  const data = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

  return { data, pagination: { page: Number(page), limit: Number(limit), total: Number(count), pages: Math.ceil(count / limit) } };
}

export async function getMeasurement(id) {
  const m = await db(MEAS).where({ id }).first();
  if (!m) throw notFound('Masurarea nu a fost gasita.', 'MASURARE_NEGASITA');
  return m;
}

export async function createMeasurement(body) {
  const { plan_id, order_id, measurement_type, instrument_id, operator_id, values: rawValues, instrument_calibration_valid, notes, tenant_id } = body;
  if (!plan_id) throw badRequest('plan_id obligatoriu.', 'PLAN_ID_LIPSA');
  if (!measurement_type) throw badRequest('measurement_type obligatoriu.', 'TYPE_LIPSA');

  const plan = await getPlan(plan_id);
  const characteristics = typeof plan.characteristics === 'string' ? JSON.parse(plan.characteristics) : (plan.characteristics || []);

  // Evaluate each value against tolerances
  const evaluatedValues = evaluateValues(rawValues || [], characteristics);
  const overallResult = evaluatedValues.some(v => v.result === 'fail') ? 'fail' : 'pass';

  const [measurement] = await db(MEAS).insert({
    plan_id,
    order_id: order_id || null,
    measurement_type: measurement_type || 'inline',
    instrument_id: instrument_id || null,
    operator_id: operator_id || null,
    values: JSON.stringify(evaluatedValues),
    overall_result: overallResult,
    instrument_calibration_valid: instrument_calibration_valid !== false,
    notes: notes || null,
    tenant_id: tenant_id || null,
  }).returning('*');

  return measurement;
}

// ── Measurement Report per Order ─────────────────────────────────────────

export async function getMeasurementReport(orderId) {
  // Get all measurements for this order
  const measurements = await db(MEAS)
    .where('order_id', orderId)
    .orderBy('created_at');

  // Get the measurement plans
  const plans = [];
  for (const m of measurements) {
    if (m.plan_id) {
      const plan = await db(PLANS).where('id', m.plan_id).first();
      if (plan && !plans.find(p => p.id === plan.id)) plans.push(plan);
    }
  }

  return {
    orderId,
    measurements,
    plans,
    totalMeasurements: measurements.length,
    passedCount: measurements.filter(m => m.overall_result === 'pass').length,
    failedCount: measurements.filter(m => m.overall_result === 'fail').length,
    overallStatus: measurements.length === 0
      ? 'NO_DATA'
      : measurements.every(m => m.overall_result === 'pass') ? 'CONFORMANT' : 'NON-CONFORMANT',
  };
}

// ── First Article Inspection ─────────────────────────────────────────────

export async function createFAI(body) {
  const { plan_id } = body;
  if (!plan_id) throw badRequest('plan_id obligatoriu.', 'PLAN_ID_LIPSA');

  const plan = await getPlan(plan_id);
  const characteristics = typeof plan.characteristics === 'string' ? JSON.parse(plan.characteristics) : (plan.characteristics || []);

  const rawValues = body.values || [];

  // For FAI, all characteristics must be measured
  const measuredNames = rawValues.map(v => v.name);
  const missing = characteristics.filter(c => !measuredNames.includes(c.name));
  if (missing.length > 0) {
    throw badRequest(`FAI: caracteristici lipsa: ${missing.map(m => m.name).join(', ')}`, 'FAI_INCOMPLETE');
  }

  return createMeasurement({ ...body, measurement_type: 'fai' });
}

// ════════════════════════════════════════════════════════════════════════
// SPC
// ════════════════════════════════════════════════════════════════════════

export async function calculateSPC(productId, characteristicName) {
  if (!productId || !characteristicName) {
    throw badRequest('productId si characteristic obligatorii.', 'SPC_PARAMS_LIPSA');
  }

  // Fetch all measurement plans for this product
  const plans = await db(PLANS).where({ product_id: productId });
  if (plans.length === 0) throw notFound('Niciun plan gasit pentru acest produs.', 'PLAN_NEGASIT');

  const planIds = plans.map(p => p.id);

  // Fetch all measurements for these plans
  const measurements = await db(MEAS).whereIn('plan_id', planIds).orderBy('created_at', 'asc');

  // Extract values for the specific characteristic
  const dataPoints = [];
  let USL = null;
  let LSL = null;

  // Get tolerance from plan characteristics
  for (const plan of plans) {
    const chars = typeof plan.characteristics === 'string' ? JSON.parse(plan.characteristics) : (plan.characteristics || []);
    const charDef = chars.find(c => c.name === characteristicName);
    if (charDef) {
      const nominal = Number(charDef.nominal);
      USL = nominal + Number(charDef.upper_tolerance || 0);
      LSL = nominal - Math.abs(Number(charDef.lower_tolerance || 0));
      break;
    }
  }

  for (const m of measurements) {
    const vals = typeof m.values === 'string' ? JSON.parse(m.values) : (m.values || []);
    const found = vals.find(v => v.name === characteristicName);
    if (found && found.measured !== undefined && found.measured !== null) {
      dataPoints.push(Number(found.measured));
    }
  }

  const n = dataPoints.length;
  if (n < 2) {
    return {
      productId,
      characteristicName,
      sampleCount: n,
      dataPoints,
      mean: n === 1 ? dataPoints[0] : null,
      stdDev: null,
      ucl: null,
      lcl: null,
      cp: null,
      cpk: null,
      inControl: true,
      usl: USL,
      lsl: LSL,
    };
  }

  // Calculate SPC metrics
  const mean = dataPoints.reduce((s, v) => s + v, 0) / n;
  const variance = dataPoints.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  const ucl = mean + 3 * stdDev;
  const lcl = mean - 3 * stdDev;

  let cp = null;
  let cpk = null;
  if (USL !== null && LSL !== null && stdDev > 0) {
    cp = (USL - LSL) / (6 * stdDev);
    cpk = Math.min(
      (USL - mean) / (3 * stdDev),
      (mean - LSL) / (3 * stdDev)
    );
  }

  // Check if all points are in control
  const outOfControl = dataPoints.filter(v => v < lcl || v > ucl);
  const inControl = outOfControl.length === 0;

  // Persist SPC data points
  const spcRows = dataPoints.map((v, i) => ({
    product_id: productId,
    characteristic_name: characteristicName,
    sample_nr: i + 1,
    value: v,
    mean: round4(mean),
    std_dev: round4(stdDev),
    ucl: round4(ucl),
    lcl: round4(lcl),
    cp: cp !== null ? round4(cp) : null,
    cpk: cpk !== null ? round4(cpk) : null,
    in_control: v >= lcl && v <= ucl,
    calculated_at: new Date(),
  }));

  // Clear old SPC data for this product/characteristic, then insert new
  await db(SPC).where({ product_id: productId, characteristic_name: characteristicName }).del();
  if (spcRows.length > 0) {
    await db(SPC).insert(spcRows);
  }

  return {
    productId,
    characteristicName,
    sampleCount: n,
    dataPoints,
    mean: round4(mean),
    stdDev: round4(stdDev),
    ucl: round4(ucl),
    lcl: round4(lcl),
    cp: cp !== null ? round4(cp) : null,
    cpk: cpk !== null ? round4(cpk) : null,
    inControl,
    outOfControlCount: outOfControl.length,
    usl: USL,
    lsl: LSL,
  };
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

// ════════════════════════════════════════════════════════════════════════
// NCR
// ════════════════════════════════════════════════════════════════════════

async function generateNCRNumber() {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `NCR-${datePart}-`;

  const last = await db(NCR)
    .where('ncr_number', 'like', `${prefix}%`)
    .orderBy('ncr_number', 'desc')
    .first();

  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.ncr_number.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export async function listNCR({ status, severity, ncrType, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  let query = db(NCR);

  if (status) query = query.where({ status });
  if (severity) query = query.where({ severity });
  if (ncrType) query = query.where({ ncr_type: ncrType });

  const [{ count }] = await query.clone().count('id as count');
  const data = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

  return { data, pagination: { page: Number(page), limit: Number(limit), total: Number(count), pages: Math.ceil(count / limit) } };
}

export async function getNCR(id) {
  const ncr = await db(NCR).where({ id }).first();
  if (!ncr) throw notFound('NCR nu a fost gasit.', 'NCR_NEGASIT');
  return ncr;
}

export async function createNCR(body) {
  const { title, ncr_type, severity, description, product_id, order_id, lot_id, affected_qty, reported_by, tenant_id } = body;
  if (!title) throw badRequest('title obligatoriu.', 'NCR_TITLE_LIPSA');
  if (!ncr_type) throw badRequest('ncr_type obligatoriu.', 'NCR_TYPE_LIPSA');
  if (!severity) throw badRequest('severity obligatoriu.', 'NCR_SEVERITY_LIPSA');

  const ncr_number = await generateNCRNumber();

  const [ncr] = await db(NCR).insert({
    ncr_number,
    title,
    description: description || null,
    ncr_type,
    severity,
    status: 'open',
    product_id: product_id || null,
    order_id: order_id || null,
    lot_id: lot_id || null,
    affected_qty: affected_qty || null,
    reported_by: reported_by || null,
    tenant_id: tenant_id || null,
  }).returning('*');

  return ncr;
}

export async function updateNCR(id, body) {
  const existing = await getNCR(id);
  if (existing.status === 'closed') throw badRequest('NCR este deja inchis.', 'NCR_CLOSED');

  const updates = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.ncr_type !== undefined) updates.ncr_type = body.ncr_type;
  if (body.severity !== undefined) updates.severity = body.severity;
  if (body.status !== undefined) updates.status = body.status;
  if (body.root_cause !== undefined) updates.root_cause = body.root_cause;
  if (body.disposition !== undefined) updates.disposition = body.disposition;
  if (body.affected_qty !== undefined) updates.affected_qty = body.affected_qty;
  if (body.product_id !== undefined) updates.product_id = body.product_id;
  if (body.order_id !== undefined) updates.order_id = body.order_id;
  if (body.lot_id !== undefined) updates.lot_id = body.lot_id;

  if (Object.keys(updates).length === 0) return existing;

  const [updated] = await db(NCR).where({ id }).update(updates).returning('*');
  return updated;
}

export async function closeNCR(id, body = {}) {
  const existing = await getNCR(id);
  if (existing.status === 'closed') throw badRequest('NCR este deja inchis.', 'NCR_CLOSED');

  const updates = {
    status: 'closed',
    closed_at: new Date(),
  };
  if (body.root_cause !== undefined) updates.root_cause = body.root_cause;
  if (body.disposition !== undefined) updates.disposition = body.disposition;

  const [updated] = await db(NCR).where({ id }).update(updates).returning('*');
  return updated;
}

// ════════════════════════════════════════════════════════════════════════
// CAPA
// ════════════════════════════════════════════════════════════════════════

async function generateCAPANumber() {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CAPA-${datePart}-`;

  const last = await db(CAPA)
    .where('capa_number', 'like', `${prefix}%`)
    .orderBy('capa_number', 'desc')
    .first();

  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.capa_number.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export async function listCAPA({ ncrId, status, capaType, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  let query = db(CAPA);

  if (ncrId) query = query.where({ ncr_id: ncrId });
  if (status) query = query.where({ status });
  if (capaType) query = query.where({ capa_type: capaType });

  const [{ count }] = await query.clone().count('id as count');
  const data = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

  return { data, pagination: { page: Number(page), limit: Number(limit), total: Number(count), pages: Math.ceil(count / limit) } };
}

export async function createCAPA(body) {
  const { ncr_id, capa_type, title, description, responsible_user_id, deadline, tenant_id } = body;
  if (!title) throw badRequest('title obligatoriu.', 'CAPA_TITLE_LIPSA');
  if (!capa_type) throw badRequest('capa_type obligatoriu.', 'CAPA_TYPE_LIPSA');

  const capa_number = await generateCAPANumber();

  const [capa] = await db(CAPA).insert({
    capa_number,
    ncr_id: ncr_id || null,
    capa_type,
    title,
    description: description || null,
    responsible_user_id: responsible_user_id || null,
    deadline: deadline || null,
    status: 'open',
    tenant_id: tenant_id || null,
  }).returning('*');

  return capa;
}

export async function updateCAPA(id, body) {
  const existing = await db(CAPA).where({ id }).first();
  if (!existing) throw notFound('CAPA nu a fost gasit.', 'CAPA_NEGASIT');
  if (existing.status === 'closed') throw badRequest('CAPA este deja inchis.', 'CAPA_CLOSED');

  const updates = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.capa_type !== undefined) updates.capa_type = body.capa_type;
  if (body.responsible_user_id !== undefined) updates.responsible_user_id = body.responsible_user_id;
  if (body.deadline !== undefined) updates.deadline = body.deadline;
  if (body.status !== undefined) updates.status = body.status;
  if (body.completion_notes !== undefined) updates.completion_notes = body.completion_notes;

  // If status transitions to completed, set completed_at
  if (body.status === 'completed' && existing.status !== 'completed') {
    updates.completed_at = new Date();
  }

  if (Object.keys(updates).length === 0) return existing;

  const [updated] = await db(CAPA).where({ id }).update(updates).returning('*');
  return updated;
}

export async function verifyCAPA(id, body = {}) {
  const existing = await db(CAPA).where({ id }).first();
  if (!existing) throw notFound('CAPA nu a fost gasit.', 'CAPA_NEGASIT');

  if (!['completed', 'not_effective'].includes(existing.status) && existing.status !== 'in_progress') {
    // Allow verification from completed or in_progress
  }

  const isEffective = body.is_effective !== false;
  const updates = {
    status: isEffective ? 'verified' : 'not_effective',
    verification_notes: body.verification_notes || null,
    verified_by: body.verified_by || null,
    verified_at: new Date(),
  };

  const [updated] = await db(CAPA).where({ id }).update(updates).returning('*');
  return updated;
}
