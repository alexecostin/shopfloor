/**
 * Apply tenant scope filter to a Knex query builder.
 * Usage: const q = db('production.orders'); applyScopeFilter(q, req); const results = await q;
 */
export function applyScopeFilter(queryBuilder, req) {
  if (!req || !req.tenantFilter) return queryBuilder;

  const { tenantId, orgUnitIds } = req.tenantFilter;

  if (tenantId) {
    queryBuilder.where(function() {
      this.where('tenant_id', tenantId).orWhereNull('tenant_id');
    });
  }

  if (orgUnitIds && orgUnitIds.length > 0) {
    queryBuilder.where(function() {
      this.whereIn('org_unit_id', orgUnitIds).orWhereNull('org_unit_id');
    });
  }

  return queryBuilder;
}
