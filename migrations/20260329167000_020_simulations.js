export async function up(knex) {
  await knex.schema.withSchema('planning').createTable('simulations', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.text('description');
    t.uuid('base_run_id').nullable().references('id').inTable('planning.scheduling_runs').onDelete('SET NULL');
    t.uuid('simulation_run_id').nullable().references('id').inTable('planning.scheduling_runs').onDelete('SET NULL');
    t.jsonb('constraints_modified').defaultTo('{}');
    t.jsonb('impact_summary').defaultTo('{}');
    t.string('status', 20).defaultTo('pending').checkIn(['pending', 'running', 'completed', 'failed', 'applied']);
    t.uuid('created_by').notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('completed_at', { useTz: true }).nullable();
  });
}

export async function down(knex) {
  await knex.schema.withSchema('planning').dropTableIfExists('simulations');
}
