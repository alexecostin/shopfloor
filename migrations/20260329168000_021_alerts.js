export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS alerts');

  await knex.schema.withSchema('alerts').createTable('rule_definitions', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('code', 100).notNullable().unique();
    t.string('name', 255).notNullable();
    t.text('description');
    t.string('severity', 20).notNullable().defaultTo('warning').checkIn(['info', 'warning', 'critical']);
    t.boolean('is_predefined').defaultTo(false);
    t.boolean('is_active').defaultTo(true);
    t.jsonb('parameters').defaultTo('{}'); // configurable thresholds
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('alerts').createTable('notification_channels', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('rule_id').notNullable().references('id').inTable('alerts.rule_definitions').onDelete('CASCADE');
    t.string('channel_type', 20).notNullable().checkIn(['app', 'email', 'push']);
    t.string('recipient', 255); // email address or user id
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('alerts').createTable('alerts', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('rule_id').notNullable().references('id').inTable('alerts.rule_definitions').onDelete('CASCADE');
    t.string('entity_type', 50); // 'machine', 'order', 'item', 'operator'
    t.uuid('entity_id').nullable();
    t.string('title', 255).notNullable();
    t.text('message');
    t.string('severity', 20).notNullable().defaultTo('warning').checkIn(['info', 'warning', 'critical']);
    t.string('status', 20).defaultTo('new').checkIn(['new', 'seen', 'resolved']);
    t.jsonb('suggested_actions').defaultTo('[]');
    t.jsonb('metadata').defaultTo('{}');
    t.uuid('acknowledged_by').nullable();
    t.timestamp('acknowledged_at', { useTz: true }).nullable();
    t.uuid('resolved_by').nullable();
    t.timestamp('resolved_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts.alerts(status)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_alerts_entity ON alerts.alerts(entity_type, entity_id)');
}

export async function down(knex) {
  await knex.schema.withSchema('alerts').dropTableIfExists('alerts');
  await knex.schema.withSchema('alerts').dropTableIfExists('notification_channels');
  await knex.schema.withSchema('alerts').dropTableIfExists('rule_definitions');
}
