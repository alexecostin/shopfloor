export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS shipments');

  // Sequence for shipment numbers
  await knex.raw(`CREATE SEQUENCE IF NOT EXISTS shipments.shipment_number_seq START WITH 1 INCREMENT BY 1`);

  await knex.schema.withSchema('shipments').createTable('shipments', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('shipment_number', 50).notNullable().unique();
    t.uuid('order_id').nullable();
    t.uuid('client_company_id').nullable();
    t.string('status', 30).notNullable().defaultTo('preparing');
    t.integer('quantity_shipped').notNullable().defaultTo(0);
    t.boolean('is_partial').defaultTo(false);
    t.text('delivery_address').nullable();
    t.string('transport_type', 30).notNullable().defaultTo('own');
    t.uuid('transporter_company_id').nullable();
    t.string('vehicle_number', 50).nullable();
    t.string('driver_name', 255).nullable();
    t.text('notes').nullable();
    t.timestamp('dispatched_at', { useTz: true }).nullable();
    t.timestamp('delivered_at', { useTz: true }).nullable();
    t.string('delivery_confirmed_by', 255).nullable();
    t.uuid('tenant_id').nullable();
    t.uuid('created_by').nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Check constraint for status
  await knex.raw(`
    ALTER TABLE shipments.shipments
    ADD CONSTRAINT chk_shipment_status
    CHECK (status IN ('preparing','dispatched','in_transit','delivered','cancelled'))
  `);

  // Check constraint for transport_type
  await knex.raw(`
    ALTER TABLE shipments.shipments
    ADD CONSTRAINT chk_transport_type
    CHECK (transport_type IN ('own','courier','client_pickup'))
  `);

  await knex.schema.withSchema('shipments').createTable('shipment_packages', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('shipment_id').notNullable()
      .references('id').inTable('shipments.shipments').onDelete('CASCADE');
    t.integer('package_number').notNullable();
    t.string('package_type', 30).notNullable().defaultTo('cutie');
    t.integer('quantity_in_package').notNullable().defaultTo(0);
    t.decimal('gross_weight_kg', 10, 3).nullable();
    t.decimal('net_weight_kg', 10, 3).nullable();
    t.string('dimensions', 100).nullable();
    t.uuid('barcode_id').nullable();
    t.text('notes').nullable();
  });

  // Check constraint for package_type
  await knex.raw(`
    ALTER TABLE shipments.shipment_packages
    ADD CONSTRAINT chk_package_type
    CHECK (package_type IN ('palet','cutie','vrac','container'))
  `);

  await knex.schema.withSchema('shipments').createTable('shipment_documents', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('shipment_id').notNullable()
      .references('id').inTable('shipments.shipments').onDelete('CASCADE');
    t.string('document_type', 50).notNullable();
    t.text('file_url').nullable();
    t.timestamp('generated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Check constraint for document_type
  await knex.raw(`
    ALTER TABLE shipments.shipment_documents
    ADD CONSTRAINT chk_document_type
    CHECK (document_type IN ('aviz','packing_list','cmr','conformity_cert','label'))
  `);

  // Indexes
  await knex.raw('CREATE INDEX idx_shipments_shipment_number ON shipments.shipments(shipment_number)');
  await knex.raw('CREATE INDEX idx_shipments_order_id ON shipments.shipments(order_id)');
  await knex.raw('CREATE INDEX idx_shipments_status ON shipments.shipments(status)');
}

export async function down(knex) {
  await knex.schema.withSchema('shipments').dropTableIfExists('shipment_documents');
  await knex.schema.withSchema('shipments').dropTableIfExists('shipment_packages');
  await knex.schema.withSchema('shipments').dropTableIfExists('shipments');
  await knex.raw('DROP SEQUENCE IF EXISTS shipments.shipment_number_seq');
  await knex.raw('DROP SCHEMA IF EXISTS shipments CASCADE');
}
