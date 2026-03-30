export async function up(knex) {
  // lookup_definitions
  await knex.schema.withSchema('system').createTable('lookup_definitions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('lookup_type', 100).notNullable().unique();
    t.string('display_name', 255).notNullable();
    t.string('display_name_en', 255);
    t.text('description');
    t.boolean('is_system').notNullable().defaultTo(false);
    t.boolean('allow_tenant_customization').notNullable().defaultTo(true);
    t.jsonb('metadata_schema');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // lookup_values
  await knex.schema.withSchema('system').createTable('lookup_values', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id'); // null = global default
    t.string('lookup_type', 100).notNullable();
    t.string('code', 100).notNullable();
    t.string('display_name', 255).notNullable();
    t.string('display_name_en', 255);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_default').notNullable().defaultTo(false);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.string('color', 7);
    t.string('icon', 50);
    t.jsonb('metadata').defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'lookup_type', 'code']);
    t.index(['tenant_id', 'lookup_type', 'is_active']);
  });
}

export async function down(knex) {
  await knex.schema.withSchema('system').dropTableIfExists('lookup_values');
  await knex.schema.withSchema('system').dropTableIfExists('lookup_definitions');
}
