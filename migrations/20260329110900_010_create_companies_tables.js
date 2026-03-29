export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS companies');

  await knex.schema.withSchema('companies').createTable('companies', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('company_type', 50).notNullable().checkIn(['client', 'supplier', 'prospect', 'both']);
    t.string('fiscal_code', 50);
    t.string('trade_register', 50);
    t.text('address');
    t.string('city', 100);
    t.string('country', 100).defaultTo('Romania');
    t.string('phone', 50);
    t.string('email', 255);
    t.string('website', 255);
    t.integer('payment_terms_days').defaultTo(30);
    t.text('notes');
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('companies').createTable('contacts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('company_id').notNullable().references('id').inTable('companies.companies').onDelete('CASCADE');
    t.string('full_name', 255).notNullable();
    t.string('role', 100);
    t.string('phone', 50);
    t.string('email', 255);
    t.boolean('is_primary').defaultTo(false);
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.withSchema('companies').dropTableIfExists('contacts');
  await knex.schema.withSchema('companies').dropTableIfExists('companies');
  await knex.raw('DROP SCHEMA IF EXISTS companies');
}
