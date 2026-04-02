import db from '../config/db.js';

export async function listCertifications(userId) {
  return db('auth.operator_certifications').where({ user_id: userId, is_active: true }).orderBy('machine_type');
}

export async function addCertification(data) {
  const [cert] = await db('auth.operator_certifications').insert({
    user_id: data.userId,
    machine_type: data.machineType,
    controller_type: data.controllerType || null,
    certification_level: data.level || 'operator',
    certified_date: data.certifiedDate,
    expiry_date: data.expiryDate || null,
    certified_by: data.certifiedBy || null,
    certificate_url: data.certificateUrl || null,
    tenant_id: data.tenantId || null,
  }).returning('*');
  return cert;
}

export async function removeCertification(id) {
  return db('auth.operator_certifications').where('id', id).update({ is_active: false });
}

export async function addException(data) {
  const [exc] = await db('auth.certification_exceptions').insert({
    user_id: data.userId,
    machine_id: data.machineId,
    exception_type: data.exceptionType, // 'allow' or 'deny'
    reason: data.reason || null,
    tenant_id: data.tenantId || null,
  }).returning('*');
  return exc;
}

export async function removeException(id) {
  return db('auth.certification_exceptions').where('id', id).delete();
}

/**
 * Check if an operator can operate a specific machine.
 * Logic: certified on machine_type + controller_type, no deny exception, or has allow exception.
 */
export async function canOperateMachine(userId, machineId) {
  const machine = await db('machines.machines').where('id', machineId).first();
  if (!machine) return { allowed: false, reason: 'Masina nu exista' };

  // Check deny exception first
  const denyException = await db('auth.certification_exceptions')
    .where({ user_id: userId, machine_id: machineId, exception_type: 'deny' }).first();
  if (denyException) return { allowed: false, reason: `Exceptie negativa: ${denyException.reason || 'Acces interzis pe aceasta masina'}` };

  // Check allow exception (overrides missing certification)
  const allowException = await db('auth.certification_exceptions')
    .where({ user_id: userId, machine_id: machineId, exception_type: 'allow' }).first();
  if (allowException) return { allowed: true, reason: 'Exceptie pozitiva', exception: true };

  // Check certification by machine_type + controller_type
  let certQuery = db('auth.operator_certifications')
    .where({ user_id: userId, machine_type: machine.type, is_active: true });
  if (machine.controller_type) {
    certQuery = certQuery.where(q => q.where('controller_type', machine.controller_type).orWhereNull('controller_type'));
  }
  const cert = await certQuery.first();

  if (!cert) return { allowed: false, reason: `Necertificat pe ${machine.type}${machine.controller_type ? ' / ' + machine.controller_type : ''}` };

  // Check expiry
  if (cert.expiry_date && new Date(cert.expiry_date) < new Date()) {
    return { allowed: false, reason: `Certificare expirata la ${cert.expiry_date}` };
  }

  return { allowed: true, reason: 'Certificat', certification: cert };
}

/**
 * Get all operators certified for a specific machine.
 */
export async function getCertifiedOperators(machineId) {
  const machine = await db('machines.machines').where('id', machineId).first();
  if (!machine) return [];

  let query = db('auth.operator_certifications as oc')
    .join('auth.users as u', 'oc.user_id', 'u.id')
    .where({ 'oc.machine_type': machine.type, 'oc.is_active': true, 'u.is_active': true });
  if (machine.controller_type) {
    query = query.where(q => q.where('oc.controller_type', machine.controller_type).orWhereNull('oc.controller_type'));
  }

  const operators = await query.select('u.id', 'u.full_name', 'u.email', 'oc.certification_level', 'oc.expiry_date');

  // Filter out expired and denied
  const result = [];
  for (const op of operators) {
    if (op.expiry_date && new Date(op.expiry_date) < new Date()) continue;
    const denied = await db('auth.certification_exceptions')
      .where({ user_id: op.id, machine_id: machineId, exception_type: 'deny' }).first();
    if (denied) continue;
    result.push(op);
  }

  // Add allow exceptions (operators not certified but with exception)
  const exceptions = await db('auth.certification_exceptions as ce')
    .join('auth.users as u', 'ce.user_id', 'u.id')
    .where({ 'ce.machine_id': machineId, 'ce.exception_type': 'allow', 'u.is_active': true })
    .select('u.id', 'u.full_name', 'u.email', 'ce.reason');
  for (const ex of exceptions) {
    if (!result.find(r => r.id === ex.id)) {
      result.push({ ...ex, certification_level: 'exception', expiry_date: null });
    }
  }

  return result;
}
