import db from '../config/db.js';

/**
 * Get all org unit IDs accessible by a user recursively.
 * If user has access to "Fabrica Cluj" (parent), they also see all children.
 */
async function getAccessibleOrgUnits(tenantId, scopeOrgUnitIds) {
  if (!scopeOrgUnitIds || scopeOrgUnitIds.length === 0) return [];

  // Get all org units for this tenant
  const allUnits = await db('org.units').where({ tenant_id: tenantId, is_active: true }).select('id', 'parent_id');

  // Build a map: parentId → [childIds]
  const childrenMap = {};
  for (const unit of allUnits) {
    if (unit.parent_id) {
      if (!childrenMap[unit.parent_id]) childrenMap[unit.parent_id] = [];
      childrenMap[unit.parent_id].push(unit.id);
    }
  }

  // BFS to get all descendants of each scope unit
  const accessible = new Set(scopeOrgUnitIds);
  const queue = [...scopeOrgUnitIds];
  while (queue.length > 0) {
    const current = queue.shift();
    const children = childrenMap[current] || [];
    for (const child of children) {
      if (!accessible.has(child)) {
        accessible.add(child);
        queue.push(child);
      }
    }
  }

  return Array.from(accessible);
}

/**
 * tenantScope middleware:
 * - Sets req.tenantFilter with tenantId and accessible org unit IDs
 * - Sets req.canWrite, req.canManage based on access level
 * - Checks license status
 */
export default function tenantScope() {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Autentificare necesara.' });

      // License check
      const licenseStatus = user.licenseStatus || 'active';
      if (licenseStatus === 'expired') {
        // Allow only specific routes
        const allowedPaths = ['/health', '/api/v1/auth/me', '/api/v1/admin/license'];
        if (!allowedPaths.some(p => req.path.startsWith(p))) {
          return res.status(403).json({ error: 'LICENSE_EXPIRED', message: 'Licenta a expirat. Contactati administratorul.' });
        }
      }
      if (licenseStatus === 'grace') {
        res.setHeader('X-License-Warning', 'Licenta expira curand. Contactati administratorul.');
      }

      const tenantId = user.tenantId;
      if (!tenantId) {
        // Legacy: no tenant in JWT yet — set defaults
        req.tenantFilter = { tenantId: null, orgUnitIds: [], accessLevel: 'admin' };
        req.canWrite = true;
        req.canManage = true;
        return next();
      }

      // Get accessible org units from JWT scopes
      const scopes = user.scopes || [];
      const scopeOrgUnitIds = scopes.map(s => s.orgUnitId).filter(Boolean);

      let accessibleOrgUnitIds = [];
      try {
        accessibleOrgUnitIds = await getAccessibleOrgUnits(tenantId, scopeOrgUnitIds);
      } catch (e) {
        // org.units table may not exist in legacy mode
        accessibleOrgUnitIds = scopeOrgUnitIds;
      }

      // Determine access level (minimum of all scopes)
      const accessLevels = ['view', 'operate', 'manage', 'admin'];
      const minLevel = scopes.reduce((min, s) => {
        const idx = accessLevels.indexOf(s.accessLevel);
        const minIdx = accessLevels.indexOf(min);
        return idx < minIdx ? s.accessLevel : min;
      }, 'admin');

      req.tenantFilter = {
        tenantId,
        orgUnitIds: accessibleOrgUnitIds,
        accessLevel: minLevel,
      };
      req.canWrite = ['operate', 'manage', 'admin'].includes(minLevel);
      req.canManage = ['manage', 'admin'].includes(minLevel);

      next();
    } catch (e) {
      next(e);
    }
  };
}
