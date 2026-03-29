export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS audit');

  await knex.schema.withSchema('audit').createTable('audit_log', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').nullable();
    t.string('action', 10).notNullable();
    t.string('resource', 255).notNullable();
    t.string('resource_id', 255).nullable();
    t.string('ip_address', 45).nullable();
    t.jsonb('details').defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.withSchema('audit').dropTableIfExists('audit_log');
  await knex.raw('DROP SCHEMA IF EXISTS audit');
}
