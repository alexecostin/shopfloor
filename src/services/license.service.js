import db from '../config/db.js';
import jwt from 'jsonwebtoken';

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'shopfloor-license-secret-2026';

/**
 * Check license status for a tenant.
 * Returns {status, daysRemaining, usersUsed, usersMax, factoriesUsed, factoriesMax}
 */
export async function checkLicense(tenantId) {
  const license = await db('system.licenses')
    .where('tenant_id', tenantId)
    .whereNot('status', 'suspended')
    .orderBy('valid_to', 'desc')
    .first();

  if (!license) {
    return { status: 'not_found', daysRemaining: 0, usersUsed: 0, usersMax: 0, factoriesUsed: 0, factoriesMax: 0 };
  }

  const today = new Date();
  const validTo = new Date(license.valid_to);
  const daysRemaining = Math.ceil((validTo - today) / 86400000);

  let status = 'active';
  if (daysRemaining < 0) {
    const graceDays = license.grace_period_days || 15;
    const daysPast = Math.abs(daysRemaining);
    status = daysPast <= graceDays ? 'grace' : 'expired';
  }

  // Count actual usage
  const [userCount, factoryCount] = await Promise.all([
    db('auth.users').where({ tenant_id: tenantId, is_active: true }).count('* as n').first().catch(() => ({ n: 0 })),
    db('org.units').where({ tenant_id: tenantId, unit_type: 'factory', is_active: true }).count('* as n').first().catch(() => ({ n: 0 })),
  ]);

  const usersUsed = Number(userCount?.n || 0);
  const factoriesUsed = Number(factoryCount?.n || 0);

  // Update DB if status changed
  if (status !== license.status) {
    await db('system.licenses').where('id', license.id).update({ status, last_check_at: new Date() });
  } else {
    await db('system.licenses').where('id', license.id).update({ last_check_at: new Date(), current_users: usersUsed, current_factories: factoriesUsed });
  }

  return {
    status,
    daysRemaining,
    usersUsed,
    usersMax: license.max_users,
    factoriesUsed,
    factoriesMax: license.max_factories,
    tier: license.tier,
    validTo: license.valid_to,
  };
}

/**
 * Check all active tenants and update license status.
 * Called by cron job every 6 hours.
 */
export async function checkAllLicenses() {
  const tenants = await db('system.tenants').where('is_active', true).select('id', 'name');
  const results = [];
  for (const tenant of tenants) {
    try {
      const result = await checkLicense(tenant.id);
      results.push({ tenantId: tenant.id, tenantName: tenant.name, ...result });
      if (result.status === 'expired') {
        console.warn(`[LICENSE] Tenant ${tenant.name} license EXPIRED`);
      }
    } catch (e) {
      results.push({ tenantId: tenant.id, error: e.message });
    }
  }
  return results;
}

/**
 * Generate a license key (JWT signed).
 */
export function generateLicenseKey({ tenantId, tier, maxUsers, maxFactories, validMonths = 12, modules = [] }) {
  const validFrom = new Date();
  const validTo = new Date();
  validTo.setMonth(validTo.getMonth() + validMonths);

  const payload = {
    tenantId,
    tier,
    maxUsers,
    maxFactories,
    validFrom: validFrom.toISOString().split('T')[0],
    validTo: validTo.toISOString().split('T')[0],
    modules,
    iss: 'shopfloor.ro',
  };

  return jwt.sign(payload, LICENSE_SECRET, { expiresIn: `${validMonths * 31}d` });
}

/**
 * Validate a license key.
 */
export function validateLicenseKey(key) {
  try {
    const payload = jwt.verify(key, LICENSE_SECRET);
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * Process on-premise heartbeat.
 */
export async function processHeartbeat({ licenseKey, currentUsers, currentFactories, version }) {
  const { valid, payload, error } = validateLicenseKey(licenseKey);
  if (!valid) return { valid: false, message: `Licenta invalida: ${error}` };

  // Update usage stats
  try {
    await db('system.licenses')
      .where('license_key', licenseKey)
      .update({ current_users: currentUsers, current_factories: currentFactories, last_check_at: new Date() });
  } catch (e) { /* key may not be in DB for pure on-premise */ }

  const today = new Date();
  const validTo = new Date(payload.validTo);
  const daysRemaining = Math.ceil((validTo - today) / 86400000);

  if (daysRemaining < 0) {
    const graceDays = 15;
    if (Math.abs(daysRemaining) > graceDays) {
      return { valid: false, message: 'Licenta expirata. Contactati shopfloor.ro pentru reinnoire.' };
    }
    return { valid: true, warning: `Licenta in grace period. Expira de ${Math.abs(daysRemaining)} zile.` };
  }

  return { valid: true, message: 'OK', daysRemaining, tier: payload.tier };
}
