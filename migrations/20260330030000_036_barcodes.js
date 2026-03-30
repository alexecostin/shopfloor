export async function up(knex) {
  await knex.schema.withSchema('inventory').createTable('barcodes', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('barcode_value', 255).notNullable().unique();
    t.string('barcode_type', 30).defaultTo('qr'); // qr, ean13, code128, datamatrix
    t.string('entity_type', 100).notNullable(); // machine, tool, inventory_item, lot, product, work_order
    t.uuid('entity_id').notNullable();
    t.string('label', 255).nullable(); // human-readable label
    t.boolean('is_active').defaultTo(true);
    t.uuid('tenant_id').nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX idx_barcodes_entity ON inventory.barcodes(entity_type, entity_id)');
  await knex.raw('CREATE INDEX idx_barcodes_value ON inventory.barcodes(barcode_value)');
}

export async function down(knex) {
  await knex.schema.withSchema('inventory').dropTableIfExists('barcodes');
}
