import bcrypt from 'bcrypt';
import crypto from 'crypto';

/**
 * METALEX SRL — Full demo seed
 * Idempotent: deletes existing Metalex data before inserting.
 */
export async function seed(knex) {
  const TENANT_SLUG = 'metalex';
  const PASSWORD = 'Test1234!';
  const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // ─── Helper: check table exists ─────────────────────────────────────────────
  async function tableExists(schema, table) {
    try {
      return await knex.schema.withSchema(schema).hasTable(table);
    } catch {
      return false;
    }
  }

  // ─── CLEANUP existing Metalex data ──────────────────────────────────────────
  const existingTenant = await knex('system.tenants').where('slug', TENANT_SLUG).first();
  if (existingTenant) {
    const tid = existingTenant.id;
    console.log(`[seed:metalex] Cleaning existing tenant ${tid}...`);

    // Delete in reverse dependency order
    const cleanups = [
      ['shifts', 'schedule_exceptions', 'tenant_id'],
      ['shifts', 'weekly_schedule', 'tenant_id'],
      ['shifts', 'shift_definitions', 'tenant_id'],
      ['production', 'hr_allocations', 'tenant_id'],
      ['production', 'work_order_operations', 'tenant_id'],
      ['production', 'work_orders', 'tenant_id'],
      ['inventory', 'stock_levels', 'tenant_id'],
      ['inventory', 'movements', 'tenant_id'],
      ['inventory', 'items', 'tenant_id'],
      ['companies', 'contacts', null], // cleaned via company cascade
      ['companies', 'companies', 'tenant_id'],
      ['machines', 'machines', 'tenant_id'],
      ['auth', 'user_scopes', null], // cleaned via user cascade
      ['auth', 'user_roles', null],  // cleaned via user cascade
      ['auth', 'users', 'tenant_id'],
      ['system', 'tenant_modules', 'tenant_id'],
      ['system', 'licenses', 'tenant_id'],
      ['org', 'units', 'tenant_id'],
      ['org', 'unit_type_definitions', 'tenant_id'],
    ];

    for (const [schema, table, col] of cleanups) {
      if (!col) continue;
      const exists = await tableExists(schema, table);
      if (exists) {
        await knex(`${schema}.${table}`).where(col, tid).delete().catch(() => {});
      }
    }
    await knex('system.tenants').where('id', tid).delete();
  }

  // Machines: we'll use onConflict merge below instead of deleting (too many FK refs)

  const userEmails = [
    'admin@metalex.ro','grigore.d@metalex.ro','ana.p@metalex.ro','mihai.r@metalex.ro',
    'costin.b@metalex.ro','elena.v@metalex.ro','bogdan.l@metalex.ro','diana.m@metalex.ro',
  ];
  await knex('auth.users').whereIn('email', userEmails).delete().catch(() => {});

  const itemCodes = ['OTEL-42CrMo4','SURUB-M8','RULMENT-SKF-6205','ULEI-HIDRAULIC'];
  // Stock levels cascade from items, so delete items
  if (await tableExists('inventory', 'stock_levels')) {
    const existingItems = await knex('inventory.items').whereIn('code', itemCodes).select('id');
    if (existingItems.length) {
      await knex('inventory.stock_levels').whereIn('item_id', existingItems.map(i => i.id)).delete().catch(() => {});
    }
  }
  await knex('inventory.items').whereIn('code', itemCodes).delete().catch(() => {});

  // Clean work orders by number
  await knex('production.work_orders').whereIn('work_order_number', ['CMD-001','CMD-002','CMD-003']).delete().catch(() => {});

  // ─── 1. TENANT ──────────────────────────────────────────────────────────────
  const [tenant] = await knex('system.tenants').insert({
    name: 'Metalex SRL',
    slug: TENANT_SLUG,
    tier: 'enterprise',
    is_active: true,
    settings: JSON.stringify({
      default_timezone: 'Europe/Bucharest',
      default_language: 'ro',
      default_currency: 'RON',
    }),
  }).returning('*');
  const T = tenant.id;
  console.log(`[seed:metalex] Tenant created: ${T}`);

  // ─── 2. ACTIVATE ALL MODULES ────────────────────────────────────────────────
  const ALL_MODULES = [
    'auth', 'machines', 'production', 'maintenance', 'checklists',
    'hr_skills', 'inventory', 'import_export', 'reports_advanced', 'alerts',
    'companies', 'bom_mbom', 'tools', 'planning', 'simulation',
    'costs_realtime', 'setup_times',
  ];
  await knex('system.tenant_modules').insert(
    ALL_MODULES.map(code => ({ tenant_id: T, module_code: code, is_active: true }))
  );
  console.log(`[seed:metalex] Activated ${ALL_MODULES.length} modules`);

  // ─── 3. ORG UNIT TYPE DEFINITIONS ───────────────────────────────────────────
  await knex('org.unit_type_definitions').insert([
    { tenant_id: T, type_code: 'company', type_label: 'Companie', level: 0 },
    { tenant_id: T, type_code: 'factory', type_label: 'Fabrica', level: 1 },
    { tenant_id: T, type_code: 'department', type_label: 'Sectie', level: 2 },
  ]);

  // ─── 4. ORG UNITS HIERARCHY ─────────────────────────────────────────────────
  // Level 0: Company
  const [orgCompany] = await knex('org.units').insert({
    tenant_id: T, parent_id: null, name: 'Metalex SRL',
    unit_type: 'company', level: 0, sort_order: 1,
    settings: JSON.stringify({ timezone: 'Europe/Bucharest' }),
  }).returning('*');

  // Level 1: Factories
  const [fabricaCluj] = await knex('org.units').insert({
    tenant_id: T, parent_id: orgCompany.id, name: 'Fabrica Cluj',
    unit_type: 'factory', level: 1, sort_order: 1,
    settings: JSON.stringify({ timezone: 'Europe/Bucharest' }),
  }).returning('*');

  const [fabricaSibiu] = await knex('org.units').insert({
    tenant_id: T, parent_id: orgCompany.id, name: 'Fabrica Sibiu',
    unit_type: 'factory', level: 1, sort_order: 2,
    settings: JSON.stringify({ timezone: 'Europe/Bucharest' }),
  }).returning('*');

  // Level 2: Departments
  const [sectiaCncCluj] = await knex('org.units').insert({
    tenant_id: T, parent_id: fabricaCluj.id, name: 'Sectia CNC',
    unit_type: 'department', level: 2, sort_order: 1,
  }).returning('*');

  const [sectiaAsamblare] = await knex('org.units').insert({
    tenant_id: T, parent_id: fabricaCluj.id, name: 'Sectia Asamblare',
    unit_type: 'department', level: 2, sort_order: 2,
  }).returning('*');

  const [sectiaDebitare] = await knex('org.units').insert({
    tenant_id: T, parent_id: fabricaCluj.id, name: 'Sectia Debitare',
    unit_type: 'department', level: 2, sort_order: 3,
  }).returning('*');

  const [sectiaCncSibiu] = await knex('org.units').insert({
    tenant_id: T, parent_id: fabricaSibiu.id, name: 'Sectia CNC Sibiu',
    unit_type: 'department', level: 2, sort_order: 1,
  }).returning('*');

  console.log('[seed:metalex] Org units created (6 units in hierarchy)');

  // ─── 5. MACHINES ────────────────────────────────────────────────────────────
  const machinesData = [
    { code: 'CNC-01', name: 'CNC-01', type: 'cnc', status: 'active', tenant_id: T, org_unit_id: sectiaCncCluj.id },
    { code: 'CNC-02', name: 'CNC-02', type: 'cnc', status: 'active', tenant_id: T, org_unit_id: sectiaCncCluj.id },
    { code: 'CNC-03', name: 'CNC-03', type: 'cnc', status: 'active', tenant_id: T, org_unit_id: sectiaCncCluj.id },
    { code: 'CNC-04', name: 'CNC-04', type: 'cnc', status: 'active', tenant_id: T, org_unit_id: sectiaCncCluj.id },
    { code: 'ASM-01', name: 'ASM-01', type: 'asamblare', status: 'active', tenant_id: T, org_unit_id: sectiaAsamblare.id },
    { code: 'ASM-02', name: 'ASM-02', type: 'asamblare', status: 'active', tenant_id: T, org_unit_id: sectiaAsamblare.id },
    { code: 'DEB-01', name: 'DEB-01', type: 'debitare', status: 'active', tenant_id: T, org_unit_id: sectiaDebitare.id },
    { code: 'CNC-S01', name: 'CNC-S01', type: 'cnc', status: 'active', tenant_id: T, org_unit_id: sectiaCncSibiu.id },
    { code: 'CNC-S02', name: 'CNC-S02', type: 'cnc', status: 'active', tenant_id: T, org_unit_id: sectiaCncSibiu.id },
  ];
  const machines = await knex('machines.machines')
    .insert(machinesData)
    .onConflict('code')
    .merge({ name: knex.raw('EXCLUDED.name'), type: knex.raw('EXCLUDED.type'), status: knex.raw('EXCLUDED.status'), tenant_id: knex.raw('EXCLUDED.tenant_id'), org_unit_id: knex.raw('EXCLUDED.org_unit_id') })
    .returning('*');
  const machineByCode = {};
  for (const m of machines) machineByCode[m.code] = m;
  console.log(`[seed:metalex] Created ${machines.length} machines`);

  // ─── 6. USERS ───────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const usersData = [
    { email: 'admin@metalex.ro', full_name: 'Admin Metalex', role: 'admin' },
    { email: 'grigore.d@metalex.ro', full_name: 'Grigore Dumitrescu', role: 'production_manager' },
    { email: 'ana.p@metalex.ro', full_name: 'Ana Popescu', role: 'production_manager' },
    { email: 'mihai.r@metalex.ro', full_name: 'Mihai Radu', role: 'shift_leader' },
    { email: 'costin.b@metalex.ro', full_name: 'Costin Barbu', role: 'operator' },
    { email: 'elena.v@metalex.ro', full_name: 'Elena Vasile', role: 'operator' },
    { email: 'bogdan.l@metalex.ro', full_name: 'Bogdan Lazar', role: 'maintenance' },
    { email: 'diana.m@metalex.ro', full_name: 'Diana Mihai', role: 'operator' },
  ];

  const users = await knex('auth.users').insert(
    usersData.map(u => ({ ...u, password_hash: passwordHash, is_active: true, tenant_id: T }))
  ).returning('*');
  const userByEmail = {};
  for (const u of users) userByEmail[u.email] = u;
  console.log(`[seed:metalex] Created ${users.length} users`);

  // ─── 7. COMPANIES & CONTACTS ────────────────────────────────────────────────
  // AutoParts GmbH
  const [autoparts] = await knex('companies.companies').insert({
    name: 'AutoParts GmbH',
    company_types: JSON.stringify(['client']),
    country: 'Germania',
    is_active: true,
    tenant_id: T,
  }).returning('*');

  await knex('companies.contacts').insert([
    {
      company_id: autoparts.id, full_name: 'Hans Mueller',
      phone: '+49170123456', email: 'hans@autoparts.de',
      department: 'Achizitii', context_tags: JSON.stringify(['comenzi_cnc']),
      relationship_type: 'client_contact',
    },
    {
      company_id: autoparts.id, full_name: 'Maria Schmidt',
      phone: '+49170234567', email: 'maria@autoparts.de',
      department: 'Calitate', context_tags: JSON.stringify(['calitate']),
      relationship_type: 'client_contact',
    },
  ]);

  // ArcelorMittal
  const [arcelor] = await knex('companies.companies').insert({
    name: 'ArcelorMittal',
    company_types: JSON.stringify(['furnizor']),
    is_active: true,
    tenant_id: T,
  }).returning('*');

  await knex('companies.contacts').insert([
    {
      company_id: arcelor.id, full_name: 'Ion Popescu',
      phone: '0722111222',
      department: 'Vanzari', context_tags: JSON.stringify(['vanzari_otel']),
      relationship_type: 'supplier_contact',
    },
    {
      company_id: arcelor.id, full_name: 'Ana Radu',
      phone: '0722333444',
      department: 'Livrari', context_tags: JSON.stringify(['livrari']),
      relationship_type: 'supplier_contact',
    },
  ]);

  // ServoTech SRL
  const [servotech] = await knex('companies.companies').insert({
    name: 'ServoTech SRL',
    company_types: JSON.stringify(['furnizor', 'firma_mentenanta']),
    country: 'Romania',
    is_active: true,
    tenant_id: T,
  }).returning('*');

  await knex('companies.contacts').insert({
    company_id: servotech.id, full_name: 'Mihai Ionescu',
    phone: '0733555666',
    department: 'Mentenanta', context_tags: JSON.stringify(['mentenanta']),
    relationship_type: 'supplier_contact',
  });

  // Sandvik
  const [sandvik] = await knex('companies.companies').insert({
    name: 'Sandvik',
    company_types: JSON.stringify(['furnizor']),
    country: 'Suedia',
    is_active: true,
    tenant_id: T,
  }).returning('*');

  await knex('companies.contacts').insert({
    company_id: sandvik.id, full_name: 'Erik Larsson',
    phone: '+46701234567',
    department: 'Scule CNC', context_tags: JSON.stringify(['scule_cnc']),
    relationship_type: 'supplier_contact',
  });

  console.log('[seed:metalex] Created 4 companies with contacts');

  // ─── 8. SHIFTS ──────────────────────────────────────────────────────────────
  // --- Fabrica Cluj shifts ---
  const [cT1, cT2, cT3] = await knex('shifts.shift_definitions').insert([
    { tenant_id: T, org_unit_id: fabricaCluj.id, shift_name: 'Tura I', shift_code: 'T1', start_time: '06:00', end_time: '14:00', crosses_midnight: false, break_minutes: 30, sort_order: 1 },
    { tenant_id: T, org_unit_id: fabricaCluj.id, shift_name: 'Tura II', shift_code: 'T2', start_time: '14:00', end_time: '22:00', crosses_midnight: false, break_minutes: 30, sort_order: 2 },
    { tenant_id: T, org_unit_id: fabricaCluj.id, shift_name: 'Tura III', shift_code: 'T3', start_time: '22:00', end_time: '06:00', crosses_midnight: true, break_minutes: 30, sort_order: 3 },
  ]).returning('*');

  // Weekly schedule Cluj: Mon-Fri T1+T2+T3, Sat T1+T2, Sun none
  const clujWeek = [];
  for (let d = 0; d <= 4; d++) {
    clujWeek.push(
      { tenant_id: T, org_unit_id: fabricaCluj.id, day_of_week: d, shift_definition_id: cT1.id },
      { tenant_id: T, org_unit_id: fabricaCluj.id, day_of_week: d, shift_definition_id: cT2.id },
      { tenant_id: T, org_unit_id: fabricaCluj.id, day_of_week: d, shift_definition_id: cT3.id },
    );
  }
  clujWeek.push(
    { tenant_id: T, org_unit_id: fabricaCluj.id, day_of_week: 5, shift_definition_id: cT1.id },
    { tenant_id: T, org_unit_id: fabricaCluj.id, day_of_week: 5, shift_definition_id: cT2.id },
  );
  await knex('shifts.weekly_schedule').insert(clujWeek);

  // --- Sectia Asamblare shifts ---
  const [aT1, aT2] = await knex('shifts.shift_definitions').insert([
    { tenant_id: T, org_unit_id: sectiaAsamblare.id, shift_name: 'Tura I', shift_code: 'T1', start_time: '06:00', end_time: '14:00', crosses_midnight: false, break_minutes: 30, sort_order: 1 },
    { tenant_id: T, org_unit_id: sectiaAsamblare.id, shift_name: 'Tura II', shift_code: 'T2', start_time: '14:00', end_time: '22:00', crosses_midnight: false, break_minutes: 30, sort_order: 2 },
  ]).returning('*');

  // Weekly schedule Asamblare: Mon-Fri T1+T2, Sat T1, Sun none
  const asmWeek = [];
  for (let d = 0; d <= 4; d++) {
    asmWeek.push(
      { tenant_id: T, org_unit_id: sectiaAsamblare.id, day_of_week: d, shift_definition_id: aT1.id },
      { tenant_id: T, org_unit_id: sectiaAsamblare.id, day_of_week: d, shift_definition_id: aT2.id },
    );
  }
  asmWeek.push(
    { tenant_id: T, org_unit_id: sectiaAsamblare.id, day_of_week: 5, shift_definition_id: aT1.id },
  );
  await knex('shifts.weekly_schedule').insert(asmWeek);

  // --- Fabrica Sibiu shifts ---
  const [sT1, sT2] = await knex('shifts.shift_definitions').insert([
    { tenant_id: T, org_unit_id: fabricaSibiu.id, shift_name: 'Tura I Sibiu', shift_code: 'TS1', start_time: '07:00', end_time: '15:30', crosses_midnight: false, break_minutes: 30, sort_order: 1 },
    { tenant_id: T, org_unit_id: fabricaSibiu.id, shift_name: 'Tura II Sibiu', shift_code: 'TS2', start_time: '15:30', end_time: '00:00', crosses_midnight: false, break_minutes: 30, sort_order: 2 },
  ]).returning('*');

  // Weekly schedule Sibiu: Mon-Fri TS1+TS2, Sat-Sun none
  const sibiuWeek = [];
  for (let d = 0; d <= 4; d++) {
    sibiuWeek.push(
      { tenant_id: T, org_unit_id: fabricaSibiu.id, day_of_week: d, shift_definition_id: sT1.id },
      { tenant_id: T, org_unit_id: fabricaSibiu.id, day_of_week: d, shift_definition_id: sT2.id },
    );
  }
  await knex('shifts.weekly_schedule').insert(sibiuWeek);

  // --- Exceptions: 1 Mai recurring for all factories ---
  const factoryIds = [fabricaCluj.id, sectiaAsamblare.id, fabricaSibiu.id];
  for (const ouId of factoryIds) {
    await knex('shifts.schedule_exceptions').insert({
      tenant_id: T,
      org_unit_id: ouId,
      exception_date: '2026-05-01',
      exception_type: 'holiday',
      name: '1 Mai — Ziua Muncii',
      active_shifts: JSON.stringify([]),
      is_recurring: true,
    });
  }

  console.log('[seed:metalex] Created shifts for Cluj (3), Asamblare (2), Sibiu (2) + weekly schedules + exceptions');

  // ─── 9. INVENTORY ITEMS ─────────────────────────────────────────────────────
  // Map user categories to DB constraint values:
  // materie_prima → raw_material, piesa_schimb → spare_part, consumabil → consumable
  const itemsData = [
    { code: 'OTEL-42CrMo4', name: 'Otel 42CrMo4', unit: 'kg', category: 'raw_material', tenant_id: T, min_stock: 200 },
    { code: 'SURUB-M8', name: 'Surub M8x25', unit: 'buc', category: 'raw_material', tenant_id: T, min_stock: 1000 },
    { code: 'RULMENT-SKF-6205', name: 'Rulment SKF 6205', unit: 'buc', category: 'spare_part', tenant_id: T, min_stock: 2 },
    { code: 'ULEI-HIDRAULIC', name: 'Ulei hidraulic ISO 46', unit: 'litri', category: 'consumable', tenant_id: T, min_stock: 50 },
  ];
  const items = await knex('inventory.items').insert(itemsData).returning('*');

  // Stock levels
  const stockData = [
    { item_id: items[0].id, current_qty: 500, tenant_id: T },
    { item_id: items[1].id, current_qty: 5000, tenant_id: T },
    { item_id: items[2].id, current_qty: 3, tenant_id: T },
    { item_id: items[3].id, current_qty: 200, tenant_id: T },
  ];
  await knex('inventory.stock_levels').insert(stockData);

  console.log(`[seed:metalex] Created ${items.length} inventory items with stock levels`);

  // ─── 10. WORK ORDERS ────────────────────────────────────────────────────────
  // Check if work_orders has tenant_id column
  const woHasTenant = await knex.schema.withSchema('production').hasColumn('work_orders', 'tenant_id').catch(() => false);
  const workOrdersData = [
    { work_order_number: 'CMD-001', product_name: 'MODUL-M22', quantity: 500, status: 'planned', priority: 'high', scheduled_end: '2026-04-18' },
    { work_order_number: 'CMD-002', product_name: 'ARBORE-S42', quantity: 300, status: 'released', priority: 'normal', scheduled_end: '2026-04-22' },
    { work_order_number: 'CMD-003', product_name: 'FLANSA-F18', quantity: 1000, status: 'released', priority: 'normal', scheduled_end: '2026-04-25' },
  ];
  if (woHasTenant) {
    workOrdersData.forEach(wo => { wo.tenant_id = T; });
  }
  await knex('production.work_orders')
    .insert(workOrdersData)
    .onConflict('work_order_number')
    .merge()
    .catch(e => console.log('[seed:metalex] work_orders insert note:', e.message));
  console.log('[seed:metalex] Created 3 work orders');

  // ─── 11. EXCHANGE RATES ─────────────────────────────────────────────────────
  if (await tableExists('system', 'exchange_rates')) {
    // Delete existing rates for today to be idempotent
    await knex('system.exchange_rates')
      .where({ valid_date: TODAY })
      .whereIn('from_currency', ['EUR', 'USD'])
      .where('to_currency', 'RON')
      .delete();

    await knex('system.exchange_rates').insert([
      { from_currency: 'EUR', to_currency: 'RON', rate: 4.97, valid_date: TODAY, source: 'manual' },
      { from_currency: 'USD', to_currency: 'RON', rate: 4.55, valid_date: TODAY, source: 'manual' },
    ]);
    console.log('[seed:metalex] Inserted exchange rates EUR/RON=4.97, USD/RON=4.55');
  } else {
    console.log('[seed:metalex] system.exchange_rates table not found — skipping');
  }

  console.log('[seed:metalex] === METALEX SRL demo seed completed successfully ===');
}
