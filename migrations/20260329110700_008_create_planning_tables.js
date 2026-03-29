export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS planning');

  await knex.schema.withSchema('planning').createTable('master_plans', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('plan_type', 20).defaultTo('weekly').checkIn(['weekly', 'monthly']);
    t.integer('week_number');
    t.integer('year').notNullable();
    t.date('start_date').notNullable();
    t.date('end_date').notNullable();
    t.integer('revision').defaultTo(1);
    t.string('status', 50).defaultTo('draft').checkIn(['draft', 'active', 'closed', 'cancelled']);
    t.uuid('created_by');
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('planning').createTable('daily_allocations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('master_plan_id').notNullable().references('id').inTable('planning.master_plans').onDelete('CASCADE');
    t.date('plan_date').notNullable();
    t.string('shift', 20).notNullable();
    t.uuid('machine_id').notNullable();
    t.uuid('product_id');
    t.string('product_reference', 100);
    t.string('product_name', 255);
    t.uuid('order_id');
    t.integer('planned_qty').defaultTo(0);
    t.integer('realized_qty').defaultTo(0);
    t.integer('scrap_qty').defaultTo(0);
    t.decimal('planned_hours', 6, 2);
    t.string('status', 50).defaultTo('planned').checkIn(['planned', 'in_progress', 'completed', 'cancelled']);
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_daily_alloc_date ON planning.daily_allocations (plan_date)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_daily_alloc_machine_date ON planning.daily_allocations (machine_id, plan_date)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_daily_alloc_plan ON planning.daily_allocations (master_plan_id)');

  await knex.schema.withSchema('planning').createTable('capacity_load', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('machine_id').notNullable();
    t.date('plan_date').notNullable();
    t.decimal('available_hours', 6, 2).defaultTo(16);
    t.decimal('planned_hours', 6, 2).defaultTo(0);
    t.decimal('load_percent', 5, 2).defaultTo(0);
    t.uuid('master_plan_id').references('id').inTable('planning.master_plans');
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['machine_id', 'plan_date']);
  });

  await knex.schema.withSchema('planning').createTable('customer_demands', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('client_name', 255);
    t.uuid('product_id');
    t.string('product_reference', 100).notNullable();
    t.date('demand_date').notNullable();
    t.integer('required_qty').notNullable();
    t.date('delivery_date');
    t.string('priority', 20).defaultTo('normal').checkIn(['low', 'normal', 'high', 'urgent']);
    t.string('status', 50).defaultTo('open').checkIn(['open', 'planned', 'fulfilled', 'cancelled']);
    t.timestamp('imported_at', { useTz: true }).defaultTo(knex.fn.now());
    t.text('notes');
  });
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_demands_date ON planning.customer_demands (demand_date)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_demands_ref ON planning.customer_demands (product_reference)');
}

export async function down(knex) {
  await knex.schema.withSchema('planning').dropTableIfExists('customer_demands');
  await knex.schema.withSchema('planning').dropTableIfExists('capacity_load');
  await knex.schema.withSchema('planning').dropTableIfExists('daily_allocations');
  await knex.schema.withSchema('planning').dropTableIfExists('master_plans');
  await knex.raw('DROP SCHEMA IF EXISTS planning');
}
