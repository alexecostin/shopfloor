export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS audit');

  await knex.schema.withSchema('audit').createTable('business_actions', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').nullable();
    t.string('user_email', 255).nullable();
    t.string('user_name', 255).nullable();
    t.string('action_type', 100).notNullable(); // e.g. 'order.created', 'user.login'
    t.string('entity_type', 100).nullable(); // e.g. 'order', 'machine', 'user'
    t.uuid('entity_id').nullable();
    t.string('entity_name', 255).nullable();
    t.text('description').nullable();
    t.jsonb('details').defaultTo('{}');
    t.string('ip_address', 50).nullable();
    t.string('user_agent', 500).nullable();
    t.uuid('tenant_id').nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_audit_actions_type ON audit.business_actions(action_type)');
  await knex.raw('CREATE INDEX idx_audit_actions_entity ON audit.business_actions(entity_type, entity_id)');
  await knex.raw('CREATE INDEX idx_audit_actions_user ON audit.business_actions(user_id)');
  await knex.raw('CREATE INDEX idx_audit_actions_date ON audit.business_actions(created_at)');
  await knex.raw('CREATE INDEX idx_audit_actions_tenant ON audit.business_actions(tenant_id)');

  await knex.schema.withSchema('audit').createTable('change_log', t => {
    t.bigIncrements('id');
    t.string('table_schema', 100).notNullable();
    t.string('table_name', 100).notNullable();
    t.string('operation', 10).notNullable(); // INSERT, UPDATE, DELETE
    t.uuid('record_id').nullable();
    t.jsonb('old_values').nullable();
    t.jsonb('new_values').nullable();
    t.jsonb('changed_fields').nullable(); // only changed columns
    t.uuid('changed_by').nullable();
    t.timestamp('changed_at', { useTz: true }).defaultTo(knex.fn.now());
    t.uuid('tenant_id').nullable();
  });

  await knex.raw('CREATE INDEX idx_audit_changelog_table ON audit.change_log(table_schema, table_name)');
  await knex.raw('CREATE INDEX idx_audit_changelog_record ON audit.change_log(record_id)');
  await knex.raw('CREATE INDEX idx_audit_changelog_date ON audit.change_log(changed_at)');
}

export async function down(knex) {
  await knex.schema.withSchema('audit').dropTableIfExists('change_log');
  await knex.schema.withSchema('audit').dropTableIfExists('business_actions');
  await knex.raw('DROP SCHEMA IF EXISTS audit');
}
