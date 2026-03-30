export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS reports');
  await knex.schema.withSchema('reports').createTable('saved_reports', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('report_type', 50).notNullable().checkIn(['prr_product', 'prr_machine', 'prr_order', 'prr_operator', 'prr_weekly_summary', 'trend', 'month_comparison']);
    t.jsonb('filters').defaultTo('{}');
    t.boolean('show_trend').defaultTo(true);
    t.integer('trend_weeks').defaultTo(8);
    t.boolean('show_month_comparison').defaultTo(true);
    t.uuid('created_by').notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.withSchema('reports').dropTableIfExists('saved_reports');
}
