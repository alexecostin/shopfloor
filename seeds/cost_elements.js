const DEFAULT_ELEMENTS = [
  { element_code: 'machine_hourly', element_name: 'Cost orar masina', category: 'machine', calculation_method: 'hourly_rate', sort_order: 1 },
  { element_code: 'labor_hourly', element_name: 'Cost orar manopera', category: 'labor', calculation_method: 'hourly_rate', sort_order: 2 },
  { element_code: 'material_direct', element_name: 'Cost materiale directe', category: 'material', calculation_method: 'per_kg', sort_order: 3 },
  { element_code: 'tooling_amortization', element_name: 'Amortizare scule/matrite', category: 'tooling', calculation_method: 'per_piece', sort_order: 4 },
  { element_code: 'consumables', element_name: 'Consumabile (ulei, lavete)', category: 'consumable', calculation_method: 'hourly_rate', sort_order: 5 },
  { element_code: 'energy', element_name: 'Energie electrica', category: 'energy', calculation_method: 'hourly_rate', sort_order: 6 },
  { element_code: 'overhead', element_name: 'Overhead fabrica', category: 'overhead', calculation_method: 'percentage', sort_order: 7 },
];

export async function seed(knex) {
  const tenants = await knex('system.tenants').select('id').catch(() => []);
  const tenantIds = tenants.length > 0 ? tenants.map(t => t.id) : [null];

  for (const tenantId of tenantIds) {
    for (const el of DEFAULT_ELEMENTS) {
      await knex('costs.cost_element_definitions')
        .insert({ ...el, tenant_id: tenantId, is_active: true })
        .onConflict(['tenant_id', 'element_code'])
        .ignore();
    }
  }
}
