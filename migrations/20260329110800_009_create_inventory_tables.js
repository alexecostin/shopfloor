export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS inventory');

  await knex.schema.withSchema('inventory').createTable('items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('code', 100).unique().notNullable();
    t.string('name', 255).notNullable();
    t.string('category', 50).notNullable()
      .checkIn(['raw_material', 'semi_finished', 'finished_good', 'consumable', 'packaging', 'spare_part', 'tool']);
    t.string('unit', 20).defaultTo('buc');
    t.uuid('product_id');
    t.string('supplier_name', 255);
    t.string('supplier_code', 100);
    t.decimal('min_stock', 12, 2).defaultTo(0);
    t.decimal('max_stock', 12, 2);
    t.decimal('reorder_qty', 12, 2);
    t.integer('lead_time_days');
    t.string('location', 255);
    t.decimal('weight_per_unit_kg', 10, 4);
    t.decimal('cost_per_unit', 12, 4);
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('inventory').createTable('stock_levels', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('item_id').notNullable().unique().references('id').inTable('inventory.items').onDelete('CASCADE');
    t.decimal('current_qty', 12, 2).defaultTo(0);
    t.decimal('reserved_qty', 12, 2).defaultTo(0);
    t.timestamp('last_movement_at', { useTz: true });
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('inventory').createTable('movements', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('item_id').notNullable().references('id').inTable('inventory.items');
    t.string('movement_type', 50).notNullable()
      .checkIn(['receipt', 'production_input', 'production_output', 'shipment',
        'adjustment_plus', 'adjustment_minus', 'scrap', 'return_supplier', 'transfer']);
    t.decimal('qty', 12, 2).notNullable();
    t.string('reference_type', 50);
    t.uuid('reference_id');
    t.string('reference_number', 100);
    t.string('lot_number', 100);
    t.string('supplier_name', 255);
    t.decimal('unit_cost', 12, 4);
    t.decimal('total_cost', 12, 4);
    t.string('location', 255);
    t.uuid('performed_by');
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_movements_item_date ON inventory.movements (item_id, created_at)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_movements_type ON inventory.movements (movement_type)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_movements_ref ON inventory.movements (reference_id)');

  await knex.schema.withSchema('inventory').createTable('material_requirements', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('order_id');
    t.string('product_reference', 100);
    t.string('product_name', 255);
    t.string('material_code', 100);
    t.string('material_name', 255);
    t.decimal('required_qty', 12, 4).notNullable();
    t.decimal('available_qty', 12, 4);
    t.decimal('shortage_qty', 12, 4);
    t.string('unit', 20);
    t.string('status', 50).defaultTo('calculated').checkIn(['calculated', 'ordered', 'received', 'fulfilled']);
    t.timestamp('calculated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.date('plan_date');
    t.text('notes');
  });

  await knex.schema.withSchema('inventory').createTable('warehouse_documents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('document_type', 50).notNullable()
      .checkIn(['receipt_note', 'issue_note', 'transfer_note', 'return_note']);
    t.string('document_number', 100).unique().notNullable();
    t.date('document_date').defaultTo(knex.fn.now());
    t.string('partner_name', 255);
    t.string('status', 50).defaultTo('draft').checkIn(['draft', 'confirmed', 'cancelled']);
    t.decimal('total_value', 12, 2);
    t.uuid('created_by');
    t.uuid('confirmed_by');
    t.timestamp('confirmed_at', { useTz: true });
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('inventory').createTable('warehouse_document_lines', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('document_id').notNullable().references('id').inTable('inventory.warehouse_documents').onDelete('CASCADE');
    t.uuid('item_id').references('id').inTable('inventory.items');
    t.string('item_code', 100);
    t.string('item_name', 255);
    t.decimal('qty', 12, 2).notNullable();
    t.string('unit', 20);
    t.decimal('unit_cost', 12, 4);
    t.decimal('total_cost', 12, 4);
    t.string('lot_number', 100);
    t.text('notes');
  });

  // Sequences for document numbers
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS inventory.nir_seq START 1');
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS inventory.bc_seq START 1');
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS inventory.tr_seq START 1');
}

export async function down(knex) {
  await knex.raw('DROP SEQUENCE IF EXISTS inventory.tr_seq');
  await knex.raw('DROP SEQUENCE IF EXISTS inventory.bc_seq');
  await knex.raw('DROP SEQUENCE IF EXISTS inventory.nir_seq');
  await knex.schema.withSchema('inventory').dropTableIfExists('warehouse_document_lines');
  await knex.schema.withSchema('inventory').dropTableIfExists('warehouse_documents');
  await knex.schema.withSchema('inventory').dropTableIfExists('material_requirements');
  await knex.schema.withSchema('inventory').dropTableIfExists('movements');
  await knex.schema.withSchema('inventory').dropTableIfExists('stock_levels');
  await knex.schema.withSchema('inventory').dropTableIfExists('items');
  await knex.raw('DROP SCHEMA IF EXISTS inventory');
}
