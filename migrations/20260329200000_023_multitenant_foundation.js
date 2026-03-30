export async function up(knex) {
  // ─── 1. SCHEMAS ────────────────────────────────────────────────────────────
  await knex.raw('CREATE SCHEMA IF NOT EXISTS system');
  await knex.raw('CREATE SCHEMA IF NOT EXISTS org');
  await knex.raw('CREATE SCHEMA IF NOT EXISTS modules');

  // ─── 2. system.tenants ─────────────────────────────────────────────────────
  await knex.schema.withSchema('system').createTable('tenants', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('slug', 100).unique().notNullable();
    t.string('tier', 20).defaultTo('basic').checkIn(['basic', 'professional', 'enterprise']);
    t.boolean('is_active').defaultTo(true);
    t.jsonb('settings').defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ─── 3. org.unit_type_definitions ──────────────────────────────────────────
  await knex.schema.withSchema('org').createTable('unit_type_definitions', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('system.tenants').onDelete('CASCADE');
    t.string('type_code', 50).notNullable();
    t.string('type_label', 100).notNullable();
    t.integer('level').notNullable();
    t.string('icon', 50).nullable();
    t.unique(['tenant_id', 'type_code']);
  });

  // ─── 4. org.units ──────────────────────────────────────────────────────────
  await knex.schema.withSchema('org').createTable('units', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('system.tenants').onDelete('CASCADE');
    t.uuid('parent_id').nullable();
    t.string('name', 255).notNullable();
    t.string('unit_type', 50).notNullable();
    t.string('code', 50).nullable();
    t.integer('level').notNullable().defaultTo(1);
    t.text('address').nullable();
    t.jsonb('settings').defaultTo('{}');
    t.boolean('is_active').defaultTo(true);
    t.integer('sort_order').defaultTo(0);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_org_units_tenant_parent ON org.units(tenant_id, parent_id)');

  // Self-referencing FK (add after table creation)
  await knex.raw('ALTER TABLE org.units ADD CONSTRAINT fk_org_units_parent FOREIGN KEY (parent_id) REFERENCES org.units(id) ON DELETE SET NULL');

  // ─── 5. system.tenant_modules ──────────────────────────────────────────────
  await knex.schema.withSchema('system').createTable('tenant_modules', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('system.tenants').onDelete('CASCADE');
    t.string('module_code', 50).notNullable();
    t.boolean('is_active').defaultTo(true);
    t.timestamp('activated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('expires_at', { useTz: true }).nullable();
    t.unique(['tenant_id', 'module_code']);
  });

  // ─── 6. system.licenses ────────────────────────────────────────────────────
  await knex.schema.withSchema('system').createTable('licenses', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('system.tenants').onDelete('CASCADE');
    t.string('license_key', 255).unique().notNullable();
    t.string('license_type', 20).defaultTo('cloud').checkIn(['cloud', 'on_premise']);
    t.string('tier', 20).notNullable();
    t.integer('max_users').notNullable().defaultTo(10);
    t.integer('max_factories').notNullable().defaultTo(1);
    t.integer('current_users').defaultTo(0);
    t.integer('current_factories').defaultTo(0);
    t.decimal('price_eur_monthly', 10, 2).nullable();
    t.date('valid_from').notNullable();
    t.date('valid_to').notNullable();
    t.integer('grace_period_days').defaultTo(15);
    t.string('status', 20).defaultTo('active').checkIn(['active', 'grace', 'expired', 'suspended']);
    t.timestamp('last_check_at', { useTz: true }).nullable();
    t.jsonb('metadata').defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ─── 7. auth.roles ─────────────────────────────────────────────────────────
  await knex.schema.withSchema('auth').createTable('roles', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').nullable(); // null = predefined global role
    t.string('name', 100).notNullable();
    t.string('code', 50).notNullable();
    t.text('description');
    t.boolean('is_predefined').defaultTo(false);
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  // Partial unique index: code must be unique among global (predefined) roles
  await knex.raw('CREATE UNIQUE INDEX idx_auth_roles_code_global ON auth.roles(code) WHERE tenant_id IS NULL');

  // ─── 8. auth.permissions ───────────────────────────────────────────────────
  await knex.schema.withSchema('auth').createTable('permissions', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('code', 100).unique().notNullable();
    t.string('module_code', 50).notNullable();
    t.string('name', 255).notNullable();
    t.text('description');
    t.string('category', 50);
  });

  // ─── 9. auth.role_permissions ──────────────────────────────────────────────
  await knex.schema.withSchema('auth').createTable('role_permissions', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('role_id').notNullable().references('id').inTable('auth.roles').onDelete('CASCADE');
    t.uuid('permission_id').notNullable().references('id').inTable('auth.permissions').onDelete('CASCADE');
    t.unique(['role_id', 'permission_id']);
  });

  // ─── 10. auth.user_roles ───────────────────────────────────────────────────
  await knex.schema.withSchema('auth').createTable('user_roles', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('auth.users').onDelete('CASCADE');
    t.uuid('role_id').notNullable().references('id').inTable('auth.roles').onDelete('CASCADE');
    t.timestamp('assigned_at', { useTz: true }).defaultTo(knex.fn.now());
    t.uuid('assigned_by').nullable();
    t.unique(['user_id', 'role_id']);
  });

  // ─── 11. auth.user_scopes ──────────────────────────────────────────────────
  await knex.schema.withSchema('auth').createTable('user_scopes', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('auth.users').onDelete('CASCADE');
    t.uuid('org_unit_id').notNullable().references('id').inTable('org.units').onDelete('CASCADE');
    t.string('access_level', 20).defaultTo('operate').checkIn(['view', 'operate', 'manage', 'admin']);
    t.unique(['user_id', 'org_unit_id']);
  });

  // ─── 12. modules.feature_flags ─────────────────────────────────────────────
  await knex.schema.withSchema('modules').createTable('feature_flags', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('module_code', 50).notNullable();
    t.string('feature_path', 255).notNullable();
    t.string('upsell_tier', 20).nullable();
    t.text('upsell_message').nullable();
  });

  // ─── 13. ADD tenant_id + org_unit_id TO EXISTING TABLES ───────────────────
  // We do this AFTER creating the demo tenant and org unit (in seed),
  // but to avoid chicken-egg, add columns as nullable first, then backfill in seed.
  const tablesToAlter = [
    'auth.users',
    'machines.machines',
    'production.orders',
    'production.reports',
    'production.stops',
    'production.shifts',
    'checklists.templates',
    'checklists.completions',
    'maintenance.requests',
    'bom.products',
    'bom.operations',
    'bom.materials',
    'planning.master_plans',
    'planning.daily_allocations',
    'planning.customer_demands',
    'inventory.items',
    'inventory.stock_levels',
    'inventory.movements',
    'companies.companies',
    'alerts.alerts',
    'costs.cost_snapshots',
    'imports.templates',
    'imports.import_logs',
    'planning.scheduling_runs',
    'planning.scheduled_operations',
  ];

  for (const tableRef of tablesToAlter) {
    const [schema, table] = tableRef.split('.');
    const exists = await knex.schema.withSchema(schema).hasTable(table);
    if (!exists) continue;

    const hasTenantId = await knex.schema.withSchema(schema).hasColumn(table, 'tenant_id');
    if (!hasTenantId) {
      await knex.schema.withSchema(schema).alterTable(table, t => {
        t.uuid('tenant_id').nullable();
        t.uuid('org_unit_id').nullable();
      });
    }
  }
}

export async function down(knex) {
  // Remove tenant_id/org_unit_id from existing tables
  const tablesToAlter = [
    'auth.users', 'machines.machines', 'production.orders', 'production.reports',
    'production.stops', 'production.shifts', 'checklists.templates', 'checklists.completions',
    'maintenance.requests', 'bom.products', 'bom.operations', 'bom.materials',
    'planning.master_plans', 'planning.daily_allocations', 'planning.customer_demands',
    'inventory.items', 'inventory.stock_levels', 'inventory.movements',
    'companies.companies',
  ];
  for (const tableRef of tablesToAlter) {
    const [schema, table] = tableRef.split('.');
    const exists = await knex.schema.withSchema(schema).hasTable(table);
    if (!exists) continue;
    await knex.schema.withSchema(schema).alterTable(table, t => {
      t.dropColumn('tenant_id');
      t.dropColumn('org_unit_id');
    }).catch(() => {});
  }

  await knex.schema.withSchema('modules').dropTableIfExists('feature_flags');
  await knex.schema.withSchema('auth').dropTableIfExists('user_scopes');
  await knex.schema.withSchema('auth').dropTableIfExists('user_roles');
  await knex.schema.withSchema('auth').dropTableIfExists('role_permissions');
  await knex.schema.withSchema('auth').dropTableIfExists('permissions');
  await knex.schema.withSchema('auth').dropTableIfExists('roles');
  await knex.schema.withSchema('system').dropTableIfExists('licenses');
  await knex.schema.withSchema('system').dropTableIfExists('tenant_modules');
  await knex.schema.withSchema('org').dropTableIfExists('units');
  await knex.schema.withSchema('org').dropTableIfExists('unit_type_definitions');
  await knex.schema.withSchema('system').dropTableIfExists('tenants');
}
