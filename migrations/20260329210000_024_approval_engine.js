export async function up(knex) {
  // Create approvals schema
  await knex.raw('CREATE SCHEMA IF NOT EXISTS approvals');

  // workflow_definitions
  await knex.schema.withSchema('approvals').createTable('workflow_definitions', t => {
    t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
    t.uuid('tenant_id').references('id').inTable('system.tenants').onDelete('CASCADE');
    t.string('document_type', 50).notNullable();
    t.string('name', 255).notNullable();
    t.integer('levels').notNullable().defaultTo(1);
    t.jsonb('level_config').notNullable().defaultTo('[]');
    t.jsonb('auto_approve_conditions');
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'document_type']);
  });

  // approval_requests
  await knex.schema.withSchema('approvals').createTable('approval_requests', t => {
    t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
    t.uuid('tenant_id').references('id').inTable('system.tenants').onDelete('CASCADE');
    t.uuid('workflow_id').references('id').inTable('approvals.workflow_definitions');
    t.string('document_type', 50).notNullable();
    t.uuid('document_id').notNullable();
    t.string('document_reference', 255);
    t.string('version', 20).notNullable();
    t.integer('current_level').defaultTo(1);
    t.integer('total_levels').notNullable();
    t.string('status', 20).defaultTo('pending')
      .checkIn(['pending','approved','rejected','cancelled']);
    t.uuid('submitted_by').references('id').inTable('auth.users');
    t.timestamp('submitted_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('completed_at', { useTz: true }).nullable();
    t.text('final_comment');
    t.index(['document_type','document_id']);
    t.index('status');
    t.index('tenant_id');
  });

  // approval_steps
  await knex.schema.withSchema('approvals').createTable('approval_steps', t => {
    t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
    t.uuid('request_id').references('id').inTable('approvals.approval_requests').onDelete('CASCADE');
    t.integer('level').notNullable();
    t.string('level_label', 100);
    t.string('status', 20).defaultTo('waiting')
      .checkIn(['waiting','approved','rejected','skipped']);
    t.uuid('decided_by').references('id').inTable('auth.users');
    t.timestamp('decided_at', { useTz: true }).nullable();
    t.text('comment');
    t.string('required_role', 50);
    t.index(['request_id','level']);
  });

  // document_versions
  await knex.schema.withSchema('approvals').createTable('document_versions', t => {
    t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
    t.uuid('tenant_id').references('id').inTable('system.tenants').onDelete('CASCADE');
    t.string('document_type', 50).notNullable();
    t.uuid('document_id').notNullable();
    t.string('version', 20).notNullable();
    t.jsonb('snapshot').notNullable();
    t.jsonb('changes_from_previous');
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.uuid('approval_request_id').references('id').inTable('approvals.approval_requests');
    t.index(['document_type','document_id']);
  });

  // Add columns to bom.products
  await knex.schema.withSchema('bom').table('products', t => {
    t.string('approval_status', 20).defaultTo('draft')
      .checkIn(['draft','pending_approval','active','archived']);
    t.string('current_version', 20).defaultTo('0.1');
    t.timestamp('approved_at', { useTz: true }).nullable();
    t.uuid('approved_by');
  });
}

export async function down(knex) {
  await knex.schema.withSchema('bom').table('products', t => {
    t.dropColumn('approval_status');
    t.dropColumn('current_version');
    t.dropColumn('approved_at');
    t.dropColumn('approved_by');
  });
  await knex.schema.withSchema('approvals').dropTableIfExists('document_versions');
  await knex.schema.withSchema('approvals').dropTableIfExists('approval_steps');
  await knex.schema.withSchema('approvals').dropTableIfExists('approval_requests');
  await knex.schema.withSchema('approvals').dropTableIfExists('workflow_definitions');
  await knex.raw('DROP SCHEMA IF EXISTS approvals');
}
