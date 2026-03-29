export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS bom');

  await knex.schema.withSchema('bom').createTable('products', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('reference', 100).unique().notNullable();
    t.string('name', 255).notNullable();
    t.string('variant', 100);
    t.string('client_name', 255);
    t.string('client_part_number', 100);
    t.string('product_type', 50).defaultTo('finished')
      .checkIn(['raw_material', 'semi_finished', 'finished', 'component']);
    t.string('container_type', 100);
    t.integer('qty_per_container');
    t.decimal('weight_piece_kg', 10, 4);
    t.decimal('weight_runner_kg', 10, 4);
    t.string('material_type', 100);
    t.text('notes');
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('bom').createTable('operations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('product_id').notNullable().references('id').inTable('bom.products').onDelete('CASCADE');
    t.integer('sequence').notNullable();
    t.string('operation_name', 255).notNullable();
    t.string('operation_type', 100);
    t.string('machine_type', 100);
    t.uuid('machine_id');
    t.decimal('cycle_time_seconds', 10, 2);
    t.integer('nr_cavities').defaultTo(1);
    t.decimal('pieces_per_hour', 10, 2);
    t.integer('setup_time_minutes').defaultTo(0);
    t.text('description');
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['product_id', 'sequence']);
  });

  await knex.schema.withSchema('bom').createTable('materials', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('product_id').notNullable().references('id').inTable('bom.products').onDelete('CASCADE');
    t.string('material_name', 255).notNullable();
    t.string('material_code', 100);
    t.string('material_type', 100);
    t.decimal('qty_per_piece', 10, 6).notNullable();
    t.string('unit', 20).defaultTo('kg');
    t.decimal('waste_factor', 5, 3).defaultTo(1.0);
    t.string('supplier', 255);
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('bom').createTable('assembly_components', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('parent_product_id').notNullable().references('id').inTable('bom.products');
    t.uuid('component_product_id').references('id').inTable('bom.products');
    t.string('component_reference', 100);
    t.string('component_name', 255);
    t.decimal('qty_per_parent', 10, 4).defaultTo(1);
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('bom').createTable('cost_rates', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('rate_type', 50).checkIn(['machine_hourly', 'labor_hourly', 'overhead', 'material']);
    t.uuid('reference_id');
    t.string('reference_name', 255);
    t.decimal('rate_eur_per_hour', 10, 2);
    t.decimal('rate_eur_per_unit', 10, 4);
    t.date('valid_from').defaultTo(knex.fn.now());
    t.date('valid_to');
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.withSchema('bom').dropTableIfExists('cost_rates');
  await knex.schema.withSchema('bom').dropTableIfExists('assembly_components');
  await knex.schema.withSchema('bom').dropTableIfExists('materials');
  await knex.schema.withSchema('bom').dropTableIfExists('operations');
  await knex.schema.withSchema('bom').dropTableIfExists('products');
  await knex.raw('DROP SCHEMA IF EXISTS bom');
}
