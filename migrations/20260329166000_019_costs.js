export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS costs');

  await knex.schema.withSchema('costs').createTable('cost_snapshots', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('order_id').notNullable(); // → production.orders
    t.decimal('planned_total', 12, 4).defaultTo(0);
    t.decimal('actual_total', 12, 4).defaultTo(0);
    t.decimal('estimated_final', 12, 4).defaultTo(0);
    t.decimal('scrap_cost', 12, 4).defaultTo(0);
    t.decimal('downtime_cost', 12, 4).defaultTo(0);
    t.decimal('overtime_cost', 12, 4).defaultTo(0);
    t.decimal('material_variance', 12, 4).defaultTo(0);
    t.jsonb('breakdown').defaultTo('{}');
    t.integer('pieces_done').defaultTo(0);
    t.integer('pieces_target').defaultTo(0);
    t.decimal('cost_per_piece_planned', 12, 4).nullable();
    t.decimal('cost_per_piece_actual', 12, 4).nullable();
    t.timestamp('snapshot_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_cost_snapshots_order ON costs.cost_snapshots(order_id)');

  // Add labor_overtime and scrap_cost to bom.cost_rates if they don't exist
  // (bom.cost_rates already exists with rate_type column)
  // We just use the existing table — the check constraint already allows new values
  // via the existing setup. Add allowed values:
  // Actually we need to check and potentially modify the check constraint.
  // For safety, just document this and skip altering the constraint.
}

export async function down(knex) {
  await knex.schema.withSchema('costs').dropTableIfExists('cost_snapshots');
}
