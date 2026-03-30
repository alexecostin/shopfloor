export async function up(knex) {
  // CREATE maintenance.planned_interventions
  const hasPI = await knex.schema.withSchema('maintenance').hasTable('planned_interventions');
  if (!hasPI) {
    await knex.schema.withSchema('maintenance').createTable('planned_interventions', t => {
      t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
      t.uuid('tenant_id');
      t.uuid('org_unit_id');
      t.uuid('machine_id').references('id').inTable('machines.machines').notNullable();
      t.string('intervention_type', 50).defaultTo('preventive')
        .checkIn(['preventive','predictive','upgrade','calibration','inspection']);
      t.string('title', 255).notNullable();
      t.text('description');
      t.date('planned_start_date').notNullable();
      t.date('planned_end_date').notNullable();
      t.decimal('planned_duration_hours', 6, 2);
      // Executor
      t.string('executor_type', 20).notNullable().checkIn(['internal','external']);
      t.uuid('executor_company_id');
      t.uuid('executor_contact_id');
      t.text('internal_team_notes');
      // Cost
      t.decimal('estimated_cost', 12, 2);
      t.decimal('actual_cost', 12, 2);
      t.text('cost_notes');
      // Status
      t.string('status', 30).defaultTo('planned')
        .checkIn(['planned','confirmed','in_progress','completed','cancelled']);
      t.timestamp('confirmed_at', { useTz: true });
      t.uuid('confirmed_by');
      t.timestamp('started_at', { useTz: true });
      t.timestamp('completed_at', { useTz: true });
      t.uuid('completed_by');
      t.text('completion_notes');
      // Parts
      t.jsonb('parts_used').defaultTo('[]');
      // Recurrence
      t.boolean('is_recurring').defaultTo(false);
      t.jsonb('recurrence_rule');
      t.date('next_due_date');
      // Meta
      t.uuid('created_by');
      t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      t.index(['machine_id', 'status']);
      t.index(['planned_start_date', 'planned_end_date']);
    });
  }

  // CREATE machines.maintenance_schedules
  const hasMS = await knex.schema.withSchema('machines').hasTable('maintenance_schedules');
  if (!hasMS) {
    await knex.schema.withSchema('machines').createTable('maintenance_schedules', t => {
      t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
      t.uuid('machine_id').references('id').inTable('machines.machines').notNullable();
      t.string('schedule_name', 255).notNullable();
      t.string('trigger_type', 20).notNullable()
        .checkIn(['hours','months','cycles','whichever_first']);
      t.integer('interval_hours');
      t.integer('interval_months');
      t.integer('interval_cycles');
      t.timestamp('last_performed_at', { useTz: true });
      t.decimal('last_performed_hours', 10, 2);
      t.integer('last_performed_cycles');
      t.date('next_due_date');
      t.decimal('next_due_hours', 10, 2);
      t.integer('next_due_cycles');
      t.boolean('auto_create_intervention').defaultTo(true);
      t.boolean('is_active').defaultTo(true);
      t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex) {
  await knex.schema.withSchema('machines').dropTableIfExists('maintenance_schedules');
  await knex.schema.withSchema('maintenance').dropTableIfExists('planned_interventions');
}
