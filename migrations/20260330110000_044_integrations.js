export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS integrations');

  // ── Export Templates ────────────────────────────────────────────────────
  await knex.schema.withSchema('integrations').createTable('export_templates', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.text('description');
    t.string('target_system', 50).notNullable()
      .checkIn(['saga', 'winmentor', 'sap', 'generic']);
    t.string('data_source', 100).notNullable()
      .checkIn(['receipts', 'shipments', 'movements', 'production', 'inventory']);
    t.jsonb('column_config').defaultTo('[]');
    t.string('file_format', 10).notNullable().defaultTo('csv')
      .checkIn(['csv', 'xlsx', 'xml']);
    t.string('delimiter', 5).defaultTo(',');
    t.boolean('is_active').defaultTo(true);
    t.uuid('tenant_id');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_export_templates_tenant ON integrations.export_templates (tenant_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_export_templates_target ON integrations.export_templates (target_system)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_export_templates_source ON integrations.export_templates (data_source)');

  // ── Export Logs ─────────────────────────────────────────────────────────
  await knex.schema.withSchema('integrations').createTable('export_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('template_id').notNullable()
      .references('id').inTable('integrations.export_templates').onDelete('CASCADE');
    t.uuid('exported_by');
    t.date('date_from');
    t.date('date_to');
    t.integer('row_count').defaultTo(0);
    t.text('file_url');
    t.string('status', 20).notNullable().defaultTo('completed')
      .checkIn(['completed', 'failed']);
    t.text('error_message');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_export_logs_template ON integrations.export_logs (template_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_export_logs_status ON integrations.export_logs (status)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_export_logs_created ON integrations.export_logs (created_at DESC)');

  // ── Webhooks ────────────────────────────────────────────────────────────
  await knex.schema.withSchema('integrations').createTable('webhooks', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('event_type', 100).notNullable()
      .checkIn(['receipt.confirmed', 'shipment.dispatched', 'po.created', 'order.completed', 'alert.triggered']);
    t.text('target_url').notNullable();
    t.string('secret', 255);
    t.boolean('is_active').defaultTo(true);
    t.timestamp('last_triggered_at', { useTz: true });
    t.integer('last_status');
    t.uuid('tenant_id');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON integrations.webhooks (tenant_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_webhooks_event ON integrations.webhooks (event_type)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_webhooks_active ON integrations.webhooks (is_active) WHERE is_active = true');

  // ── Preseed export templates ────────────────────────────────────────────
  await knex('integrations.export_templates').insert([
    {
      name: 'Saga NIR',
      description: 'Export receptii in format Saga (NIR)',
      target_system: 'saga',
      data_source: 'receipts',
      column_config: JSON.stringify([
        { sourceField: 'receipt_number', targetColumn: 'NR_NIR', transform: 'none' },
        { sourceField: 'receipt_date', targetColumn: 'DATA_NIR', transform: 'date_ro' },
        { sourceField: 'supplier_name', targetColumn: 'FURNIZOR', transform: 'none' },
        { sourceField: 'product_name', targetColumn: 'DENUMIRE', transform: 'none' },
        { sourceField: 'quantity', targetColumn: 'CANTITATE', transform: 'number' },
        { sourceField: 'unit_price', targetColumn: 'PRET_UNITAR', transform: 'number' },
        { sourceField: 'total_value', targetColumn: 'VALOARE', transform: 'number' },
        { sourceField: 'uom', targetColumn: 'UM', transform: 'none' },
      ]),
      file_format: 'csv',
      delimiter: ',',
      is_active: true,
    },
    {
      name: 'Generic CSV',
      description: 'Export miscari stoc - toate coloanele',
      target_system: 'generic',
      data_source: 'movements',
      column_config: JSON.stringify([
        { sourceField: 'movement_date', targetColumn: 'Data', transform: 'date_ro' },
        { sourceField: 'movement_type', targetColumn: 'Tip', transform: 'none' },
        { sourceField: 'product_name', targetColumn: 'Produs', transform: 'none' },
        { sourceField: 'quantity', targetColumn: 'Cantitate', transform: 'number' },
        { sourceField: 'from_location', targetColumn: 'Din locatie', transform: 'none' },
        { sourceField: 'to_location', targetColumn: 'In locatie', transform: 'none' },
        { sourceField: 'reference', targetColumn: 'Referinta', transform: 'none' },
        { sourceField: 'notes', targetColumn: 'Observatii', transform: 'none' },
      ]),
      file_format: 'csv',
      delimiter: ',',
      is_active: true,
    },
  ]);
}

export async function down(knex) {
  await knex.schema.withSchema('integrations').dropTableIfExists('export_logs');
  await knex.schema.withSchema('integrations').dropTableIfExists('webhooks');
  await knex.schema.withSchema('integrations').dropTableIfExists('export_templates');
  await knex.raw('DROP SCHEMA IF EXISTS integrations');
}
