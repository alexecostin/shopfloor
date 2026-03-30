export async function up(knex) {
  await knex.schema.withSchema('planning').createTable('scheduling_configs', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.text('description');
    t.jsonb('priorities').defaultTo('[]');
    // priorities example: [{"criterion": "deadline", "weight": 40}, {"criterion": "utilization", "weight": 30}, ...]
    t.jsonb('constraints').defaultTo('{}');
    // constraints example: {"respect_shifts": true, "allow_overtime": false, "planning_granularity": "shift"}
    t.boolean('is_default').defaultTo(false);
    t.boolean('is_active').defaultTo(true);
    t.uuid('created_by').notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('planning').createTable('scheduling_runs', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.uuid('config_id').nullable().references('id').inTable('planning.scheduling_configs').onDelete('SET NULL');
    t.string('run_type', 20).defaultTo('standard').checkIn(['standard', 'simulation']);
    t.string('status', 20).defaultTo('pending').checkIn(['pending', 'running', 'completed', 'failed', 'applied']);
    t.date('period_start').notNullable();
    t.date('period_end').notNullable();
    t.jsonb('result_summary').defaultTo('{}');
    t.jsonb('warnings').defaultTo('[]');
    t.uuid('created_by').notNullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('completed_at', { useTz: true }).nullable();
  });

  await knex.schema.withSchema('planning').createTable('scheduled_operations', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('run_id').notNullable().references('id').inTable('planning.scheduling_runs').onDelete('CASCADE');
    t.uuid('order_id').nullable(); // → production.orders
    t.uuid('operation_id').nullable(); // → bom.operations
    t.uuid('machine_id').notNullable().references('id').inTable('machines.machines').onDelete('CASCADE');
    t.uuid('operator_id').nullable(); // → auth.users
    t.string('product_name', 255);
    t.string('product_code', 100);
    t.integer('quantity').notNullable().defaultTo(0);
    t.date('planned_date').notNullable();
    t.string('planned_shift', 20);
    t.integer('sequence').defaultTo(0);
    t.integer('setup_minutes').defaultTo(0);
    t.decimal('planned_hours', 10, 2).defaultTo(0);
    t.string('status', 20).defaultTo('planned').checkIn(['planned', 'conflict', 'applied']);
    t.text('conflict_reason');
    t.boolean('dependency_met').defaultTo(true);
    t.jsonb('metadata').defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_sched_ops_run ON planning.scheduled_operations(run_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_sched_ops_machine_date ON planning.scheduled_operations(machine_id, planned_date)');
}

export async function down(knex) {
  await knex.schema.withSchema('planning').dropTableIfExists('scheduled_operations');
  await knex.schema.withSchema('planning').dropTableIfExists('scheduling_runs');
  await knex.schema.withSchema('planning').dropTableIfExists('scheduling_configs');
}
