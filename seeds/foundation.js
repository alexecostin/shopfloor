export async function seed(knex) {
  // ─── 1. DEMO TENANT ────────────────────────────────────────────────────────
  const [tenant] = await knex('system.tenants').insert({
    name: 'Demo Fabrica SRL',
    slug: 'demo',
    tier: 'enterprise',
    is_active: true,
    settings: JSON.stringify({ currency: 'EUR', timezone: 'Europe/Bucharest', language: 'ro' }),
  }).onConflict('slug').merge().returning('*');

  // ─── 2. DEFAULT ORG UNIT ───────────────────────────────────────────────────
  const [orgUnit] = await knex('org.units').insert({
    tenant_id: tenant.id,
    name: 'Fabrica Demo',
    unit_type: 'factory',
    code: 'DEMO',
    level: 1,
  }).returning('*');

  // ─── 3. BACKFILL tenant_id + org_unit_id on existing data ─────────────────
  const tablesToBackfill = [
    'auth.users', 'machines.machines', 'production.orders', 'production.reports',
    'production.stops', 'production.shifts', 'checklists.templates', 'checklists.completions',
    'maintenance.requests', 'bom.products', 'bom.operations', 'bom.materials',
    'planning.master_plans', 'planning.daily_allocations', 'planning.customer_demands',
    'inventory.items', 'inventory.stock_levels', 'inventory.movements',
    'companies.companies',
  ];

  for (const tableRef of tablesToBackfill) {
    try {
      await knex.raw(`UPDATE ${tableRef} SET tenant_id = ?, org_unit_id = ? WHERE tenant_id IS NULL`, [tenant.id, orgUnit.id]);
    } catch (e) { /* table may not exist */ }
  }

  // ─── 4. DEFAULT ORG UNIT TYPE DEFINITIONS ──────────────────────────────────
  await knex('org.unit_type_definitions').insert([
    { tenant_id: tenant.id, type_code: 'factory', type_label: 'Fabrica', level: 1, icon: '🏭' },
    { tenant_id: tenant.id, type_code: 'department', type_label: 'Sectie', level: 2, icon: '🔧' },
    { tenant_id: tenant.id, type_code: 'line', type_label: 'Linie', level: 3, icon: '⚙️' },
    { tenant_id: tenant.id, type_code: 'shift_group', type_label: 'Tura', level: 3, icon: '👷' },
  ]).onConflict(['tenant_id', 'type_code']).ignore();

  // ─── 5. LICENSE ────────────────────────────────────────────────────────────
  const validFrom = new Date();
  const validTo = new Date();
  validTo.setFullYear(validTo.getFullYear() + 2);

  await knex('system.licenses').insert({
    tenant_id: tenant.id,
    license_key: `DEMO-ENTERPRISE-${Date.now()}`,
    license_type: 'cloud',
    tier: 'enterprise',
    max_users: 100,
    max_factories: 10,
    current_users: 1,
    current_factories: 1,
    valid_from: validFrom.toISOString().split('T')[0],
    valid_to: validTo.toISOString().split('T')[0],
    status: 'active',
  }).onConflict().ignore();

  // ─── 6. ACTIVATE ALL MODULES ───────────────────────────────────────────────
  const modules = [
    'auth', 'machines', 'production', 'maintenance', 'checklists',
    'hr_skills', 'inventory', 'import_export', 'reports_advanced', 'alerts', 'companies',
    'bom_mbom', 'tools', 'planning', 'simulation', 'costs_realtime', 'setup_times',
  ];
  for (const module_code of modules) {
    await knex('system.tenant_modules').insert({ tenant_id: tenant.id, module_code, is_active: true }).onConflict(['tenant_id', 'module_code']).merge();
  }

  // Ensure partial unique index exists (idempotent — needed if migration ran before this index was added)
  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_roles_code_global ON auth.roles(code) WHERE tenant_id IS NULL');

  // ─── 7. PREDEFINED ROLES ───────────────────────────────────────────────────
  const roles = [
    { code: 'admin', name: 'Administrator', description: 'Acces complet' },
    { code: 'director', name: 'Director', description: 'Dashboard executiv, costuri, rapoarte' },
    { code: 'planner', name: 'Planificator', description: 'Planning, BOM, comenzi' },
    { code: 'shift_leader', name: 'Sef Tura', description: 'Productia din tura' },
    { code: 'operator', name: 'Operator', description: 'Raportare productie' },
    { code: 'maintenance', name: 'Mentenanta', description: 'Intretinere utilaje' },
    { code: 'logistics', name: 'Logistica', description: 'Stocuri si aprovizionare' },
    { code: 'viewer', name: 'Observator', description: 'Acces citire' },
  ];

  const insertedRoles = {};
  for (const role of roles) {
    const [r] = await knex('auth.roles').insert({
      ...role,
      tenant_id: null,
      is_predefined: true,
      is_active: true,
    }).onConflict(knex.raw('(code) WHERE tenant_id IS NULL')).merge().returning('*');
    insertedRoles[role.code] = r;
  }

  // ─── 8. PERMISSIONS ────────────────────────────────────────────────────────
  const permissionsList = [
    // production
    { code: 'production.orders.view', module_code: 'production', name: 'Vizualizare comenzi', category: 'production' },
    { code: 'production.orders.create', module_code: 'production', name: 'Creare comenzi', category: 'production' },
    { code: 'production.orders.edit', module_code: 'production', name: 'Editare comenzi', category: 'production' },
    { code: 'production.reports.create', module_code: 'production', name: 'Creare rapoarte productie', category: 'production' },
    { code: 'production.reports.view_own', module_code: 'production', name: 'Vizualizare rapoarte proprii', category: 'production' },
    { code: 'production.reports.view_all', module_code: 'production', name: 'Vizualizare toate rapoartele', category: 'production' },
    { code: 'production.stops.create', module_code: 'production', name: 'Inregistrare opriri', category: 'production' },
    { code: 'production.stops.close', module_code: 'production', name: 'Inchidere opriri', category: 'production' },
    { code: 'production.dashboard.view', module_code: 'production', name: 'Dashboard productie', category: 'production' },
    { code: 'production.dashboard.view_costs', module_code: 'production', name: 'Dashboard cu costuri', category: 'production' },
    // machines
    { code: 'machines.view', module_code: 'machines', name: 'Vizualizare utilaje', category: 'machines' },
    { code: 'machines.create', module_code: 'machines', name: 'Adaugare utilaje', category: 'machines' },
    { code: 'machines.edit', module_code: 'machines', name: 'Editare utilaje', category: 'machines' },
    { code: 'machines.delete', module_code: 'machines', name: 'Stergere utilaje', category: 'machines' },
    // planning
    { code: 'planning.view', module_code: 'planning', name: 'Vizualizare planning', category: 'planning' },
    { code: 'planning.create', module_code: 'planning', name: 'Creare plan', category: 'planning' },
    { code: 'planning.edit', module_code: 'planning', name: 'Editare plan', category: 'planning' },
    { code: 'planning.generate', module_code: 'planning', name: 'Generare plan automat', category: 'planning' },
    { code: 'planning.simulate', module_code: 'simulation', name: 'Simulare what-if', category: 'planning' },
    // bom
    { code: 'bom.view', module_code: 'bom_mbom', name: 'Vizualizare BOM', category: 'bom' },
    { code: 'bom.create', module_code: 'bom_mbom', name: 'Creare BOM', category: 'bom' },
    { code: 'bom.edit', module_code: 'bom_mbom', name: 'Editare BOM', category: 'bom' },
    // inventory
    { code: 'inventory.view', module_code: 'inventory', name: 'Vizualizare stocuri', category: 'inventory' },
    { code: 'inventory.movements.create', module_code: 'inventory', name: 'Creare miscari stoc', category: 'inventory' },
    { code: 'inventory.documents.create', module_code: 'inventory', name: 'Creare documente depozit', category: 'inventory' },
    { code: 'inventory.documents.confirm', module_code: 'inventory', name: 'Confirmare documente', category: 'inventory' },
    // hr
    { code: 'hr.skills.view', module_code: 'hr_skills', name: 'Vizualizare matrice competente', category: 'hr' },
    { code: 'hr.skills.edit', module_code: 'hr_skills', name: 'Editare competente', category: 'hr' },
    { code: 'hr.leave.request', module_code: 'hr_skills', name: 'Cerere concediu', category: 'hr' },
    { code: 'hr.leave.approve', module_code: 'hr_skills', name: 'Aprobare concediu', category: 'hr' },
    // maintenance
    { code: 'maintenance.requests.create', module_code: 'maintenance', name: 'Creare cereri mentenanta', category: 'maintenance' },
    { code: 'maintenance.requests.assign', module_code: 'maintenance', name: 'Asignare cereri', category: 'maintenance' },
    { code: 'maintenance.requests.resolve', module_code: 'maintenance', name: 'Rezolvare cereri', category: 'maintenance' },
    // tools
    { code: 'tools.view', module_code: 'tools', name: 'Vizualizare scule', category: 'tools' },
    { code: 'tools.edit', module_code: 'tools', name: 'Editare scule', category: 'tools' },
    { code: 'tools.maintenance', module_code: 'tools', name: 'Mentenanta scule', category: 'tools' },
    // costs
    { code: 'costs.view', module_code: 'costs_realtime', name: 'Vizualizare costuri', category: 'costs' },
    { code: 'costs.view_profitability', module_code: 'costs_realtime', name: 'Vizualizare profitabilitate', category: 'costs' },
    // alerts
    { code: 'alerts.view', module_code: 'alerts', name: 'Vizualizare alerte', category: 'alerts' },
    { code: 'alerts.rules.edit', module_code: 'alerts', name: 'Editare reguli alerte', category: 'alerts' },
    // reports
    { code: 'reports.view', module_code: 'reports_advanced', name: 'Vizualizare rapoarte avansate', category: 'reports' },
    { code: 'reports.export', module_code: 'reports_advanced', name: 'Export rapoarte', category: 'reports' },
    // import
    { code: 'import.execute', module_code: 'import_export', name: 'Executare import', category: 'import' },
    // companies
    { code: 'companies.view', module_code: 'companies', name: 'Vizualizare companii', category: 'companies' },
    { code: 'companies.edit', module_code: 'companies', name: 'Editare companii', category: 'companies' },
    // admin
    { code: 'admin.users', module_code: 'auth', name: 'Gestiune utilizatori', category: 'admin' },
    { code: 'admin.roles', module_code: 'auth', name: 'Gestiune roluri', category: 'admin' },
    { code: 'admin.modules', module_code: 'auth', name: 'Gestiune module', category: 'admin' },
    { code: 'admin.license', module_code: 'auth', name: 'Gestiune licenta', category: 'admin' },
    { code: 'admin.org', module_code: 'auth', name: 'Gestiune organizatie', category: 'admin' },
    // checklists
    { code: 'checklists.view', module_code: 'checklists', name: 'Vizualizare checklists', category: 'checklists' },
    { code: 'checklists.complete', module_code: 'checklists', name: 'Completare checklists', category: 'checklists' },
    { code: 'checklists.manage', module_code: 'checklists', name: 'Gestiune template-uri checklists', category: 'checklists' },
  ];

  for (const perm of permissionsList) {
    await knex('auth.permissions').insert(perm).onConflict('code').ignore();
  }

  const allPerms = await knex('auth.permissions');
  const permsByCode = {};
  for (const p of allPerms) permsByCode[p.code] = p;

  // ─── 9. ROLE-PERMISSION MAPPINGS ───────────────────────────────────────────
  const rolePermMap = {
    admin: allPerms.map(p => p.code), // all
    director: allPerms.filter(p => p.code.endsWith('.view') || p.code.startsWith('costs.') || p.code === 'hr.leave.approve' || p.code.startsWith('reports.')).map(p => p.code),
    planner: ['planning.view','planning.create','planning.edit','planning.generate','planning.simulate','bom.view','bom.create','bom.edit','production.orders.view','production.orders.create','production.orders.edit','machines.view','reports.view','reports.export'],
    shift_leader: ['production.orders.view','production.reports.create','production.reports.view_all','production.stops.create','production.stops.close','production.dashboard.view','hr.leave.approve','hr.skills.view','machines.view','maintenance.requests.create','checklists.view','checklists.complete','alerts.view'],
    operator: ['production.reports.create','production.reports.view_own','production.stops.create','maintenance.requests.create','hr.leave.request','checklists.view','checklists.complete'],
    maintenance: ['maintenance.requests.create','maintenance.requests.assign','maintenance.requests.resolve','tools.view','tools.edit','tools.maintenance','machines.view'],
    logistics: ['inventory.view','inventory.movements.create','inventory.documents.create','inventory.documents.confirm','import.execute','companies.view','companies.edit','machines.view'],
    viewer: allPerms.filter(p => p.code.endsWith('.view') || p.code.endsWith('.view_all') || p.code.endsWith('.view_own')).map(p => p.code),
  };

  for (const [roleCode, permCodes] of Object.entries(rolePermMap)) {
    const role = insertedRoles[roleCode];
    if (!role) continue;
    for (const permCode of permCodes) {
      const perm = permsByCode[permCode];
      if (!perm) continue;
      await knex('auth.role_permissions').insert({ role_id: role.id, permission_id: perm.id }).onConflict(['role_id', 'permission_id']).ignore();
    }
  }

  // ─── 10. ASSIGN admin ROLE TO EXISTING ADMIN USERS ────────────────────────
  const adminRole = insertedRoles['admin'];
  const adminUsers = await knex('auth.users').where('role', 'admin');
  for (const user of adminUsers) {
    await knex('auth.user_roles').insert({ user_id: user.id, role_id: adminRole.id }).onConflict(['user_id', 'role_id']).ignore();
    await knex('auth.user_scopes').insert({ user_id: user.id, org_unit_id: orgUnit.id, access_level: 'admin' }).onConflict(['user_id', 'org_unit_id']).ignore();
  }

  console.log(`Foundation seed complete: tenant=${tenant.id}, orgUnit=${orgUnit.id}`);
}
