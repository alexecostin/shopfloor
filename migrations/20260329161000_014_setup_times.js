export async function up(knex) {
  await knex.schema.withSchema('machines').createTable('setup_defaults', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('machine_id').notNullable().references('id').inTable('machines.machines').onDelete('CASCADE');
    t.integer('default_minutes').notNullable().defaultTo(30);
    t.text('notes');
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['machine_id']);
  });

  await knex.schema.withSchema('machines').createTable('setup_overrides', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('machine_id').notNullable().references('id').inTable('machines.machines').onDelete('CASCADE');
    t.uuid('from_product_id').nullable().references('id').inTable('bom.products').onDelete('CASCADE');
    t.uuid('to_product_id').notNullable().references('id').inTable('bom.products').onDelete('CASCADE');
    t.integer('setup_minutes').notNullable();
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['machine_id', 'from_product_id', 'to_product_id']);
  });

  await knex.schema.withSchema('machines').createTable('setup_factor_definitions', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 100).notNullable();
    t.text('description');
    t.integer('sort_order').defaultTo(0);
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('machines').createTable('setup_factor_values', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('factor_id').notNullable().references('id').inTable('machines.setup_factor_definitions').onDelete('CASCADE');
    t.uuid('machine_id').notNullable().references('id').inTable('machines.machines').onDelete('CASCADE');
    t.uuid('product_id').notNullable().references('id').inTable('bom.products').onDelete('CASCADE');
    t.integer('minutes').notNullable().defaultTo(0);
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['factor_id', 'machine_id', 'product_id']);
  });
}

export async function down(knex) {
  await knex.schema.withSchema('machines').dropTableIfExists('setup_factor_values');
  await knex.schema.withSchema('machines').dropTableIfExists('setup_factor_definitions');
  await knex.schema.withSchema('machines').dropTableIfExists('setup_overrides');
  await knex.schema.withSchema('machines').dropTableIfExists('setup_defaults');
}
