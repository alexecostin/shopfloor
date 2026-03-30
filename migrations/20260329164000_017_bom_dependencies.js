export async function up(knex) {
  // Add columns to bom.operations
  await knex.schema.withSchema('bom').alterTable('operations', t => {
    t.uuid('output_product_id').nullable().references('id').inTable('bom.products').onDelete('SET NULL');
    t.string('transfer_type', 20).defaultTo('direct').checkIn(['direct', 'through_stock']);
    t.integer('min_batch_before_next').nullable();
  });

  // Create operation dependencies table
  await knex.schema.withSchema('bom').createTable('operation_dependencies', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('operation_id').notNullable().references('id').inTable('bom.operations').onDelete('CASCADE');
    t.uuid('depends_on_operation_id').notNullable().references('id').inTable('bom.operations').onDelete('CASCADE');
    t.string('dependency_type', 20).defaultTo('finish_to_start').checkIn(['finish_to_start', 'start_to_start', 'finish_to_finish']);
    t.integer('lag_minutes').defaultTo(0);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['operation_id', 'depends_on_operation_id']);
  });
}

export async function down(knex) {
  await knex.schema.withSchema('bom').dropTableIfExists('operation_dependencies');
  await knex.schema.withSchema('bom').alterTable('operations', t => {
    t.dropColumn('output_product_id');
    t.dropColumn('transfer_type');
    t.dropColumn('min_batch_before_next');
  });
}
