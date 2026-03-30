export async function up(knex) {
  // cost_element_definitions
  const hasDefs = await knex.schema.withSchema('costs').hasTable('cost_element_definitions');
  if (!hasDefs) {
    await knex.schema.withSchema('costs').createTable('cost_element_definitions', t => {
      t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
      t.uuid('tenant_id');
      t.string('element_code', 50).notNullable();
      t.string('element_name', 255).notNullable();
      t.string('category', 50).notNullable()
        .checkIn(['machine','labor','material','tooling','consumable','energy','overhead','custom']);
      t.boolean('is_active').defaultTo(true);
      t.string('calculation_method', 50)
        .checkIn(['hourly_rate','per_piece','per_kg','percentage','fixed','custom_formula']);
      t.jsonb('default_config');
      t.integer('sort_order').defaultTo(0);
      t.unique(['tenant_id', 'element_code']);
    });
  }

  // machine_cost_config
  const hasMCC = await knex.schema.withSchema('costs').hasTable('machine_cost_config');
  if (!hasMCC) {
    await knex.schema.withSchema('costs').createTable('machine_cost_config', t => {
      t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
      t.uuid('machine_id').references('id').inTable('machines.machines').notNullable();
      t.string('config_mode', 20).defaultTo('simple').checkIn(['simple','detailed']);
      // Simple
      t.decimal('hourly_rate', 10, 2);
      // Detailed
      t.decimal('depreciation_hourly', 10, 2);
      t.decimal('energy_hourly', 10, 2);
      t.decimal('space_hourly', 10, 2);
      t.decimal('insurance_hourly', 10, 2);
      t.decimal('other_hourly', 10, 2);
      // Energy
      t.decimal('power_kw', 8, 2);
      t.decimal('energy_price_per_kwh', 8, 4);
      t.date('valid_from');
      t.date('valid_to');
      t.unique(['machine_id', 'valid_from']);
    });
  }

  // operator_cost_config
  const hasOCC = await knex.schema.withSchema('costs').hasTable('operator_cost_config');
  if (!hasOCC) {
    await knex.schema.withSchema('costs').createTable('operator_cost_config', t => {
      t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
      t.uuid('tenant_id');
      t.string('config_type', 20).notNullable().checkIn(['per_operator','per_skill_level']);
      t.uuid('user_id');
      t.uuid('skill_level_id');
      t.decimal('hourly_rate', 10, 2).notNullable();
      t.decimal('overtime_rate', 10, 2);
      t.date('valid_from');
      t.date('valid_to');
    });
  }

  // overhead_config
  const hasOH = await knex.schema.withSchema('costs').hasTable('overhead_config');
  if (!hasOH) {
    await knex.schema.withSchema('costs').createTable('overhead_config', t => {
      t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
      t.uuid('tenant_id');
      t.string('overhead_name', 255).notNullable();
      t.string('overhead_type', 20).notNullable().checkIn(['percentage','fixed_monthly','per_piece']);
      t.decimal('value', 10, 4).notNullable();
      t.boolean('is_active').defaultTo(true);
    });
  }

  // ALTER machines.machines: add power_kw
  const hasPowerKw = await knex.schema.withSchema('machines').hasColumn('machines', 'power_kw');
  if (!hasPowerKw) {
    await knex.schema.withSchema('machines').table('machines', t => {
      t.decimal('power_kw', 8, 2);
    });
  }
}

export async function down(knex) {
  await knex.schema.withSchema('machines').table('machines', t => { t.dropColumn('power_kw'); }).catch(() => {});
  await knex.schema.withSchema('costs').dropTableIfExists('overhead_config');
  await knex.schema.withSchema('costs').dropTableIfExists('operator_cost_config');
  await knex.schema.withSchema('costs').dropTableIfExists('machine_cost_config');
  await knex.schema.withSchema('costs').dropTableIfExists('cost_element_definitions');
}
