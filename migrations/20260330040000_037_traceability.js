export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS traceability');

  await knex.schema.withSchema('traceability').createTable('lot_tracking', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('lot_number', 100).notNullable().unique();
    t.uuid('item_id').nullable(); // → inventory.items
    t.uuid('supplier_id').nullable();
    t.date('received_date').nullable();
    t.date('expiry_date').nullable();
    t.decimal('quantity', 14, 4).notNullable().defaultTo(0);
    t.decimal('remaining_quantity', 14, 4).notNullable().defaultTo(0);
    t.string('unit', 30).defaultTo('buc');
    t.string('status', 20).defaultTo('active'); // active, consumed, expired
    t.uuid('tenant_id').nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('traceability').createTable('production_lot_usage', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('production_report_id').notNullable(); // → production.reports
    t.uuid('lot_tracking_id').notNullable().references('id').inTable('traceability.lot_tracking').onDelete('CASCADE');
    t.decimal('quantity_used', 14, 4).notNullable().defaultTo(0);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('traceability').createTable('serial_numbers', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('serial_number', 255).notNullable().unique();
    t.uuid('product_id').nullable();
    t.uuid('production_report_id').nullable();
    t.uuid('order_id').nullable();
    t.jsonb('lot_tracking_ids').defaultTo('[]');
    t.uuid('tenant_id').nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_lot_tracking_lot_number ON traceability.lot_tracking(lot_number)');
  await knex.raw('CREATE INDEX idx_lot_tracking_item_id ON traceability.lot_tracking(item_id)');
  await knex.raw('CREATE INDEX idx_lot_tracking_status ON traceability.lot_tracking(status)');
  await knex.raw('CREATE INDEX idx_serial_numbers_serial ON traceability.serial_numbers(serial_number)');
  await knex.raw('CREATE INDEX idx_serial_numbers_product ON traceability.serial_numbers(product_id)');
  await knex.raw('CREATE INDEX idx_serial_numbers_order ON traceability.serial_numbers(order_id)');
  await knex.raw('CREATE INDEX idx_production_lot_usage_report ON traceability.production_lot_usage(production_report_id)');
  await knex.raw('CREATE INDEX idx_production_lot_usage_lot ON traceability.production_lot_usage(lot_tracking_id)');
}

export async function down(knex) {
  await knex.schema.withSchema('traceability').dropTableIfExists('serial_numbers');
  await knex.schema.withSchema('traceability').dropTableIfExists('production_lot_usage');
  await knex.schema.withSchema('traceability').dropTableIfExists('lot_tracking');
  await knex.raw('DROP SCHEMA IF EXISTS traceability CASCADE');
}
