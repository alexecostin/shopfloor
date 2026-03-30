import db from '../config/db.js';

// Cache the statuses (in-memory, refreshed on first call per process lifecycle)
let _statusCache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadStatuses(tenantId) {
  const now = Date.now();
  if (_statusCache && (now - _cacheTime) < CACHE_TTL) return _statusCache;

  // Try tenant-specific first, fallback to global
  let rows = tenantId
    ? await db('system.lookup_values').where({ tenant_id: tenantId, lookup_type: 'order_statuses', is_active: true }).orderBy('sort_order')
    : [];

  if (rows.length === 0) {
    rows = await db('system.lookup_values').whereNull('tenant_id').where({ lookup_type: 'order_statuses', is_active: true }).orderBy('sort_order');
  }

  _statusCache = rows.map(r => ({
    code: r.code,
    displayName: r.display_name,
    displayNameEn: r.display_name_en,
    color: r.color,
    isTerminal: r.metadata?.is_terminal ?? false,
    allowedTransitions: r.metadata?.allowed_transitions ?? [],
  }));
  _cacheTime = now;
  return _statusCache;
}

export async function getStatuses(tenantId) {
  return loadStatuses(tenantId);
}

export async function getStatus(tenantId, code) {
  const statuses = await loadStatuses(tenantId);
  return statuses.find(s => s.code === code) || null;
}

export async function canTransition(tenantId, fromCode, toCode) {
  const from = await getStatus(tenantId, fromCode);
  if (!from) return false;
  if (from.isTerminal) return false;
  return from.allowedTransitions.includes(toCode);
}

export async function getNextStatuses(tenantId, currentCode) {
  const current = await getStatus(tenantId, currentCode);
  if (!current || current.isTerminal) return [];
  const allStatuses = await loadStatuses(tenantId);
  return allStatuses.filter(s => current.allowedTransitions.includes(s.code));
}

export async function validateTransition(tenantId, fromCode, toCode) {
  const allowed = await canTransition(tenantId, fromCode, toCode);
  if (!allowed) {
    const from = await getStatus(tenantId, fromCode);
    if (!from) throw new Error(`Status necunoscut: ${fromCode}`);
    if (from.isTerminal) throw new Error(`Comanda in status terminal (${from.displayName}) — nu se mai poate modifica`);
    throw new Error(`Tranzitie invalida: ${from.displayName} → ${toCode}`);
  }
  return true;
}

// Invalidate cache (call after lookup values are updated)
export function invalidateCache() {
  _statusCache = null;
  _cacheTime = 0;
}
