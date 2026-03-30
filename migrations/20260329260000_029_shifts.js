export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS shifts');

  // shift_definitions with GENERATED productive_minutes
  await knex.raw(`
    CREATE TABLE shifts.shift_definitions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID,
      org_unit_id UUID NOT NULL,
      shift_name VARCHAR(50) NOT NULL,
      shift_code VARCHAR(10) NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      crosses_midnight BOOLEAN NOT NULL DEFAULT false,
      break_minutes INTEGER NOT NULL DEFAULT 30,
      productive_minutes INTEGER GENERATED ALWAYS AS (
        CASE WHEN crosses_midnight
          THEN CAST(1440 - EXTRACT(EPOCH FROM start_time)::integer/60 + EXTRACT(EPOCH FROM end_time)::integer/60 - break_minutes AS INTEGER)
          ELSE CAST(EXTRACT(EPOCH FROM end_time)::integer/60 - EXTRACT(EPOCH FROM start_time)::integer/60 - break_minutes AS INTEGER)
        END
      ) STORED,
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      UNIQUE(org_unit_id, shift_code)
    )
  `);

  await knex.schema.withSchema('shifts').createTable('weekly_schedule', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id');
    t.uuid('org_unit_id').notNullable();
    t.integer('day_of_week').notNullable(); // 0=Mon, 6=Sun
    t.uuid('shift_definition_id').notNullable().references('id').inTable('shifts.shift_definitions').onDelete('CASCADE');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.unique(['org_unit_id', 'day_of_week', 'shift_definition_id']);
  });

  await knex.schema.withSchema('shifts').createTable('schedule_exceptions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id');
    t.uuid('org_unit_id').notNullable();
    t.date('exception_date').notNullable();
    t.string('exception_type', 30).notNullable();
    t.string('name', 255);
    t.jsonb('active_shifts').defaultTo('[]');
    t.jsonb('override_times');
    t.boolean('is_recurring').notNullable().defaultTo(false);
    t.uuid('created_by');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['org_unit_id', 'exception_date']);
  });
}

export async function down(knex) {
  await knex.schema.withSchema('shifts').dropTableIfExists('schedule_exceptions');
  await knex.schema.withSchema('shifts').dropTableIfExists('weekly_schedule');
  await knex.schema.withSchema('shifts').dropTableIfExists('shift_definitions');
  await knex.raw('DROP SCHEMA IF EXISTS shifts CASCADE');
}
