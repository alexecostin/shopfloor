export async function seed(knex) {
  // Get demo tenant
  const tenant = await knex('system.tenants').where({ subdomain: 'demo' }).first();
  if (!tenant) return;

  await knex('approvals.workflow_definitions')
    .insert({
      tenant_id: tenant.id,
      document_type: 'mbom',
      name: 'Aprobare MBOM standard',
      levels: 2,
      level_config: JSON.stringify([
        { level: 1, role: 'shift_leader', label: 'Sef Sectie', canSkip: false },
        { level: 2, role: 'production_manager', label: 'Director Productie', canSkip: false }
      ]),
      is_active: true,
    })
    .onConflict(['tenant_id', 'document_type'])
    .merge();
}
