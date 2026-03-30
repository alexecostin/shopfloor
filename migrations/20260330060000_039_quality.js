export async function up(knex) {
  // Create quality schema
  await knex.raw('CREATE SCHEMA IF NOT EXISTS quality');

  // ── measurement_plans ──────────────────────────────────────────────────
  await knex.schema.withSchema('quality').createTable('measurement_plans', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('product_id').nullable();
    t.string('plan_name', 255).notNullable();
    // Array of {name, nominal, upper_tolerance, lower_tolerance, unit, is_critical}
    t.jsonb('characteristics').notNullable().defaultTo('[]');
    t.jsonb('sampling_rule').nullable();
    t.boolean('is_active').defaultTo(true);
    t.uuid('tenant_id').nullable();
    t.uuid('created_by').nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_mplans_product ON quality.measurement_plans(product_id)');
  await knex.raw('CREATE INDEX idx_mplans_tenant ON quality.measurement_plans(tenant_id)');
  await knex.raw('CREATE INDEX idx_mplans_active ON quality.measurement_plans(is_active)');

  // ── measurements ───────────────────────────────────────────────────────
  await knex.schema.withSchema('quality').createTable('measurements', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('plan_id').notNullable().references('id').inTable('quality.measurement_plans');
    t.uuid('order_id').nullable();
    t.string('measurement_type', 20).notNullable()
      .checkIn(['inline', 'fai', 'final']);
    t.uuid('instrument_id').nullable();
    t.uuid('operator_id').nullable();
    t.jsonb('values').notNullable().defaultTo('[]');
    t.string('overall_result', 10).notNullable()
      .checkIn(['pass', 'fail']);
    t.boolean('instrument_calibration_valid').defaultTo(true);
    t.text('notes').nullable();
    t.uuid('tenant_id').nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_measurements_plan ON quality.measurements(plan_id)');
  await knex.raw('CREATE INDEX idx_measurements_order ON quality.measurements(order_id)');
  await knex.raw('CREATE INDEX idx_measurements_type ON quality.measurements(measurement_type)');
  await knex.raw('CREATE INDEX idx_measurements_result ON quality.measurements(overall_result)');
  await knex.raw('CREATE INDEX idx_measurements_tenant ON quality.measurements(tenant_id)');

  // ── spc_data ───────────────────────────────────────────────────────────
  await knex.schema.withSchema('quality').createTable('spc_data', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('product_id').nullable();
    t.string('characteristic_name', 255).notNullable();
    t.integer('sample_nr').notNullable();
    t.decimal('value', 12, 4).notNullable();
    t.decimal('mean', 12, 4).nullable();
    t.decimal('std_dev', 12, 4).nullable();
    t.decimal('ucl', 12, 4).nullable();
    t.decimal('lcl', 12, 4).nullable();
    t.decimal('cp', 8, 4).nullable();
    t.decimal('cpk', 8, 4).nullable();
    t.boolean('in_control').defaultTo(true);
    t.timestamp('calculated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.uuid('tenant_id').nullable();
  });

  await knex.raw('CREATE INDEX idx_spc_product_char ON quality.spc_data(product_id, characteristic_name)');
  await knex.raw('CREATE INDEX idx_spc_tenant ON quality.spc_data(tenant_id)');

  // ── ncr ────────────────────────────────────────────────────────────────
  await knex.schema.withSchema('quality').createTable('ncr', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('ncr_number', 50).unique().notNullable();
    t.string('title', 255).notNullable();
    t.text('description').nullable();
    t.string('ncr_type', 20).notNullable()
      .checkIn(['internal', 'supplier', 'customer']);
    t.string('severity', 20).notNullable()
      .checkIn(['minor', 'major', 'critical']);
    t.string('status', 30).defaultTo('open')
      .checkIn(['open', 'investigation', 'root_cause', 'disposition', 'closed']);
    t.uuid('product_id').nullable();
    t.uuid('order_id').nullable();
    t.uuid('lot_id').nullable();
    t.text('root_cause').nullable();
    t.string('disposition', 30).nullable();
    t.integer('affected_qty').nullable();
    t.uuid('reported_by').nullable();
    t.uuid('tenant_id').nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('closed_at', { useTz: true }).nullable();
  });

  await knex.raw('CREATE INDEX idx_ncr_status ON quality.ncr(status)');
  await knex.raw('CREATE INDEX idx_ncr_severity ON quality.ncr(severity)');
  await knex.raw('CREATE INDEX idx_ncr_type ON quality.ncr(ncr_type)');
  await knex.raw('CREATE INDEX idx_ncr_tenant ON quality.ncr(tenant_id)');
  await knex.raw('CREATE INDEX idx_ncr_product ON quality.ncr(product_id)');

  // ── capa ───────────────────────────────────────────────────────────────
  await knex.schema.withSchema('quality').createTable('capa', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('capa_number', 50).unique().notNullable();
    t.uuid('ncr_id').nullable().references('id').inTable('quality.ncr');
    t.string('capa_type', 20).notNullable()
      .checkIn(['corrective', 'preventive']);
    t.string('title', 255).notNullable();
    t.text('description').nullable();
    t.uuid('responsible_user_id').nullable();
    t.date('deadline').nullable();
    t.string('status', 30).defaultTo('open')
      .checkIn(['open', 'in_progress', 'completed', 'verified', 'closed', 'not_effective']);
    t.text('completion_notes').nullable();
    t.text('verification_notes').nullable();
    t.uuid('verified_by').nullable();
    t.uuid('tenant_id').nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('completed_at', { useTz: true }).nullable();
    t.timestamp('verified_at', { useTz: true }).nullable();
  });

  await knex.raw('CREATE INDEX idx_capa_ncr ON quality.capa(ncr_id)');
  await knex.raw('CREATE INDEX idx_capa_status ON quality.capa(status)');
  await knex.raw('CREATE INDEX idx_capa_responsible ON quality.capa(responsible_user_id)');
  await knex.raw('CREATE INDEX idx_capa_deadline ON quality.capa(deadline)');
  await knex.raw('CREATE INDEX idx_capa_tenant ON quality.capa(tenant_id)');
}

export async function down(knex) {
  await knex.schema.withSchema('quality').dropTableIfExists('capa');
  await knex.schema.withSchema('quality').dropTableIfExists('ncr');
  await knex.schema.withSchema('quality').dropTableIfExists('spc_data');
  await knex.schema.withSchema('quality').dropTableIfExists('measurements');
  await knex.schema.withSchema('quality').dropTableIfExists('measurement_plans');
  await knex.raw('DROP SCHEMA IF EXISTS quality');
}
