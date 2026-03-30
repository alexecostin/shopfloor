export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS purchasing');

  // ── Purchase Orders ───────────────────────────────────────────────────────
  await knex.schema.withSchema('purchasing').createTable('purchase_orders', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('po_number', 50).unique().notNullable();
    t.uuid('supplier_id').notNullable().references('id').inTable('companies.companies');
    t.uuid('supplier_contact_id').references('id').inTable('companies.contacts');
    t.string('status', 30).notNullable().defaultTo('draft')
      .checkIn(['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled']);
    t.decimal('total_amount', 12, 2).defaultTo(0);
    t.string('currency', 3).defaultTo('RON');
    t.text('notes');
    t.timestamp('sent_at', { useTz: true });
    t.timestamp('confirmed_at', { useTz: true });
    t.date('confirmed_delivery_date');
    t.uuid('tenant_id');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_po_number ON purchasing.purchase_orders (po_number)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchasing.purchase_orders (supplier_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_po_status ON purchasing.purchase_orders (status)');

  // ── Purchase Order Lines ──────────────────────────────────────────────────
  await knex.schema.withSchema('purchasing').createTable('purchase_order_lines', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('po_id').notNullable().references('id').inTable('purchasing.purchase_orders').onDelete('CASCADE');
    t.uuid('item_id').references('id').inTable('inventory.items');
    t.string('description', 500);
    t.decimal('quantity', 12, 2).notNullable();
    t.string('unit', 20);
    t.decimal('unit_price', 12, 4).notNullable();
    t.decimal('quantity_received', 12, 2).defaultTo(0);
    t.text('notes');
  });

  // ── PO Receipts ───────────────────────────────────────────────────────────
  await knex.schema.withSchema('purchasing').createTable('po_receipts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('po_id').notNullable().references('id').inTable('purchasing.purchase_orders').onDelete('CASCADE');
    t.uuid('po_line_id').notNullable().references('id').inTable('purchasing.purchase_order_lines').onDelete('CASCADE');
    t.decimal('received_qty', 12, 2).notNullable();
    t.timestamp('received_at', { useTz: true }).defaultTo(knex.fn.now());
    t.uuid('received_by');
    t.text('notes');
    t.uuid('inventory_movement_id');
  });

  // ── Sequence for PO numbers ───────────────────────────────────────────────
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS purchasing.po_seq START 1');
}

export async function down(knex) {
  await knex.raw('DROP SEQUENCE IF EXISTS purchasing.po_seq');
  await knex.schema.withSchema('purchasing').dropTableIfExists('po_receipts');
  await knex.schema.withSchema('purchasing').dropTableIfExists('purchase_order_lines');
  await knex.schema.withSchema('purchasing').dropTableIfExists('purchase_orders');
  await knex.raw('DROP SCHEMA IF EXISTS purchasing');
}
