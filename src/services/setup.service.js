import db from '../config/db.js';

/**
 * Calculate setup time when switching from one product to another on a machine.
 * Logic:
 *   1. Check for exact override (machine + from_product + to_product)
 *   2. Check for wildcard override (machine + NULL from_product + to_product)
 *   3. Sum factor values for the machine+to_product combo
 *   4. Fall back to machine default
 *   5. Fall back to 0
 */
export async function calculateSetupTime(machineId, fromProductId, toProductId) {
  // 1. Exact override
  if (fromProductId) {
    const exact = await db('machines.setup_overrides')
      .where({ machine_id: machineId, from_product_id: fromProductId, to_product_id: toProductId })
      .first();
    if (exact) return { minutes: exact.setup_minutes, source: 'override_exact' };
  }

  // 2. Wildcard override (from_product = NULL)
  const wildcard = await db('machines.setup_overrides')
    .whereNull('from_product_id')
    .where({ machine_id: machineId, to_product_id: toProductId })
    .first();
  if (wildcard) return { minutes: wildcard.setup_minutes, source: 'override_wildcard' };

  // 3. Sum factor values
  const factors = await db('machines.setup_factor_values as sfv')
    .join('machines.setup_factor_definitions as sfd', 'sfv.factor_id', 'sfd.id')
    .where({ 'sfv.machine_id': machineId, 'sfv.product_id': toProductId, 'sfd.is_active': true })
    .sum('sfv.minutes as total')
    .first();
  if (factors && Number(factors.total) > 0) {
    return { minutes: Number(factors.total), source: 'factors' };
  }

  // 4. Machine default
  const def = await db('machines.setup_defaults').where('machine_id', machineId).first();
  if (def) return { minutes: def.default_minutes, source: 'default' };

  // 5. Fallback
  return { minutes: 0, source: 'none' };
}
