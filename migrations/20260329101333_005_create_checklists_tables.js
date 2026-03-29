export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS checklists');

  await knex.schema.withSchema('checklists').createTable('templates', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('machine_type', 100).nullable();
    t.jsonb('items').notNullable();
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('checklists').createTable('completions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('template_id').references('id').inTable('checklists.templates').nullable();
    t.uuid('machine_id').notNullable();
    t.uuid('operator_id').notNullable();
    t.string('shift', 20).nullable();
    t.jsonb('responses').notNullable();
    t.boolean('all_ok').notNullable();
    t.timestamp('completed_at').defaultTo(knex.fn.now());
  });

  await knex.raw(`CREATE INDEX idx_completions_machine_id ON checklists.completions(machine_id)`);
  await knex.raw(`CREATE INDEX idx_completions_operator_id ON checklists.completions(operator_id)`);
  await knex.raw(`CREATE INDEX idx_completions_completed_at ON checklists.completions(completed_at)`);
}

export async function down(knex) {
  await knex.schema.withSchema('checklists').dropTableIfExists('completions');
  await knex.schema.withSchema('checklists').dropTableIfExists('templates');
  await knex.raw('DROP SCHEMA IF EXISTS checklists');
}
