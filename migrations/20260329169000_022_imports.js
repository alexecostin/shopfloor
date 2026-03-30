export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS imports');

  await knex.schema.withSchema('imports').createTable('templates', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('import_type', 50).notNullable().checkIn(['orders', 'materials_receipt', 'demands', 'products', 'stock_update']);
    t.string('source_type', 50).defaultTo('excel').checkIn(['excel', 'csv', 'pdf', 'ocr', 'email', 'manual']);
    t.uuid('partner_id').nullable();
    t.string('partner_name', 255).nullable();
    t.jsonb('column_mappings').defaultTo('[]');
    t.jsonb('default_values').defaultTo('{}');
    t.integer('skip_rows').defaultTo(0);
    t.string('sheet_name', 100).nullable();
    t.boolean('is_active').defaultTo(true);
    t.timestamp('last_used_at', { useTz: true }).nullable();
    t.integer('use_count').defaultTo(0);
    t.uuid('created_by').notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('imports').createTable('import_logs', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('template_id').nullable().references('id').inTable('imports.templates').onDelete('SET NULL');
    t.string('import_type', 50).notNullable();
    t.string('source_filename', 255).nullable();
    t.string('source_type', 50).nullable();
    t.string('status', 20).defaultTo('processing').checkIn(['processing', 'preview', 'completed', 'failed', 'cancelled']);
    t.integer('total_rows').defaultTo(0);
    t.integer('valid_rows').defaultTo(0);
    t.integer('imported_rows').defaultTo(0);
    t.integer('error_rows').defaultTo(0);
    t.jsonb('detected_columns').defaultTo('[]');
    t.jsonb('applied_mappings').defaultTo('[]');
    t.jsonb('preview_rows').defaultTo('[]');
    t.text('error_message').nullable();
    t.uuid('created_by').notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('completed_at', { useTz: true }).nullable();
  });

  await knex.schema.withSchema('imports').createTable('import_row_details', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('import_log_id').notNullable().references('id').inTable('imports.import_logs').onDelete('CASCADE');
    t.integer('row_number').notNullable();
    t.jsonb('raw_data').defaultTo('{}');
    t.jsonb('mapped_data').defaultTo('{}');
    t.string('status', 20).defaultTo('pending').checkIn(['pending', 'valid', 'warning', 'error', 'imported', 'skipped']);
    t.text('error_message').nullable();
    t.jsonb('suggestions').defaultTo('[]');
  });

  await knex.schema.withSchema('imports').createTable('email_inbox', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('from_address', 255).notNullable();
    t.string('subject', 500).nullable();
    t.text('body_text').nullable();
    t.jsonb('attachments').defaultTo('[]');
    t.string('status', 20).defaultTo('pending').checkIn(['pending', 'processed', 'failed']);
    t.uuid('import_log_id').nullable().references('id').inTable('imports.import_logs').onDelete('SET NULL');
    t.timestamp('received_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('processed_at', { useTz: true }).nullable();
  });
}

export async function down(knex) {
  await knex.schema.withSchema('imports').dropTableIfExists('email_inbox');
  await knex.schema.withSchema('imports').dropTableIfExists('import_row_details');
  await knex.schema.withSchema('imports').dropTableIfExists('import_logs');
  await knex.schema.withSchema('imports').dropTableIfExists('templates');
}
