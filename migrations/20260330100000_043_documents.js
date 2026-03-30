export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS documents');

  // ── Documents ────────────────────────────────────────────────────────────
  await knex.schema.withSchema('documents').createTable('documents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('title', 255).notNullable();
    t.string('document_type', 50).notNullable()
      .checkIn(['drawing', 'procedure', 'certificate', 'report', 'manual', 'other']);
    t.text('description');
    t.jsonb('tags').defaultTo('[]');
    t.uuid('current_revision_id');
    t.boolean('is_active').defaultTo(true);
    t.uuid('tenant_id');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_documents_type ON documents.documents (document_type)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents.documents USING GIN (tags)');

  // ── Document Revisions ───────────────────────────────────────────────────
  await knex.schema.withSchema('documents').createTable('document_revisions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('document_id').notNullable().references('id').inTable('documents.documents').onDelete('CASCADE');
    t.string('revision_code', 20).notNullable();
    t.text('file_path');
    t.string('file_name', 255);
    t.integer('file_size');
    t.string('mime_type', 100);
    t.text('full_text_content');
    t.string('status', 20).notNullable().defaultTo('draft')
      .checkIn(['draft', 'pending_approval', 'approved', 'archived']);
    t.uuid('uploaded_by');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_doc_revisions_fulltext
    ON documents.document_revisions
    USING GIN (to_tsvector('simple', COALESCE(full_text_content, '')))
  `);

  // ── Document Links ───────────────────────────────────────────────────────
  await knex.schema.withSchema('documents').createTable('document_links', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('document_id').notNullable().references('id').inTable('documents.documents').onDelete('CASCADE');
    t.string('entity_type', 100).notNullable();
    t.uuid('entity_id').notNullable();
    t.string('link_type', 50).defaultTo('reference');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_doc_links_entity ON documents.document_links (entity_type, entity_id)');

  // ── Add FK for current_revision_id now that revisions table exists ───────
  await knex.raw(`
    ALTER TABLE documents.documents
    ADD CONSTRAINT fk_documents_current_revision
    FOREIGN KEY (current_revision_id) REFERENCES documents.document_revisions(id)
    ON DELETE SET NULL
  `);
}

export async function down(knex) {
  await knex.raw('ALTER TABLE documents.documents DROP CONSTRAINT IF EXISTS fk_documents_current_revision');
  await knex.schema.withSchema('documents').dropTableIfExists('document_links');
  await knex.schema.withSchema('documents').dropTableIfExists('document_revisions');
  await knex.schema.withSchema('documents').dropTableIfExists('documents');
  await knex.raw('DROP SCHEMA IF EXISTS documents');
}
