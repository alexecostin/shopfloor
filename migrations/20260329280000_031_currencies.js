export async function up(knex) {
  // Currencies table
  await knex.schema.withSchema('system').createTable('currencies', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('code', 3).notNullable().unique();
    t.string('name', 100).notNullable();
    t.string('symbol', 5).notNullable();
    t.integer('decimal_places').notNullable().defaultTo(2);
    t.boolean('is_active').notNullable().defaultTo(true);
  });

  // Exchange rates
  await knex.schema.withSchema('system').createTable('exchange_rates', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('from_currency', 3).notNullable();
    t.string('to_currency', 3).notNullable();
    t.decimal('rate', 12, 6).notNullable();
    t.date('valid_date').notNullable();
    t.string('source', 50).notNullable().defaultTo('manual');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['from_currency', 'to_currency', 'valid_date']);
    t.index(['from_currency', 'to_currency', 'valid_date']);
  });

  // Add currency column to tables that have monetary values (using raw SQL to avoid transaction abort)
  const tables = [
    ['production', 'orders'],
    ['inventory', 'purchase_history'],
    ['inventory', 'item_suppliers'],
    ['maintenance', 'planned_interventions'],
    ['machines', 'tools'],
    ['costs', 'machine_cost_config'],
    ['costs', 'operator_cost_config'],
    ['costs', 'cost_element_definitions'],
  ];

  for (const [schema, table] of tables) {
    await knex.raw(`ALTER TABLE IF EXISTS "${schema}"."${table}" ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'EUR'`);
  }
}

export async function down(knex) {
  await knex.schema.withSchema('system').dropTableIfExists('exchange_rates');
  await knex.schema.withSchema('system').dropTableIfExists('currencies');
}
