export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS production');

  // Orders
  await knex.schema.withSchema('production').createTable('orders', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('order_number', 100).unique().notNullable();
    t.string('product_name', 255).notNullable();
    t.string('product_code', 100).nullable();
    t.uuid('machine_id').notNullable();
    t.integer('target_quantity').notNullable();
    t.string('status', 50).defaultTo('active');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE production.orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN ('planned', 'active', 'completed', 'cancelled'))
  `);

  // Reports
  await knex.schema.withSchema('production').createTable('reports', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('order_id').references('id').inTable('production.orders').nullable();
    t.uuid('machine_id').notNullable();
    t.uuid('operator_id').notNullable();
    t.string('shift', 20).notNullable();
    t.integer('good_pieces').notNullable().defaultTo(0);
    t.integer('scrap_pieces').notNullable().defaultTo(0);
    t.string('scrap_reason', 255).nullable();
    t.timestamp('reported_at').defaultTo(knex.fn.now());
    t.text('notes').nullable();
  });

  // Stops
  await knex.schema.withSchema('production').createTable('stops', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('machine_id').notNullable();
    t.uuid('operator_id').notNullable();
    t.string('reason', 255).notNullable();
    t.string('category', 100).nullable();
    t.timestamp('started_at').defaultTo(knex.fn.now());
    t.timestamp('ended_at').nullable();
    t.integer('duration_minutes').nullable();
    t.string('shift', 20).nullable();
    t.text('notes').nullable();
  });

  // Shifts
  await knex.schema.withSchema('production').createTable('shifts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('shift_name', 20).notNullable();
    t.uuid('shift_leader_id').notNullable();
    t.date('date').notNullable().defaultTo(knex.raw('CURRENT_DATE'));
    t.timestamp('started_at').defaultTo(knex.fn.now());
    t.timestamp('ended_at').nullable();
    t.text('notes_incoming').nullable();
    t.text('notes_outgoing').nullable();
    t.string('status', 50).defaultTo('active');
  });

  await knex.raw(`
    ALTER TABLE production.shifts
    ADD CONSTRAINT shifts_status_check
    CHECK (status IN ('active', 'closed'))
  `);

  // Stop categories lookup
  await knex.schema.withSchema('production').createTable('stop_categories', (t) => {
    t.increments('id').primary();
    t.string('name', 100).unique().notNullable();
    t.boolean('is_active').defaultTo(true);
  });

  // Scrap reasons lookup
  await knex.schema.withSchema('production').createTable('scrap_reasons', (t) => {
    t.increments('id').primary();
    t.string('name', 100).unique().notNullable();
    t.boolean('is_active').defaultTo(true);
  });

  // Seed lookup data
  await knex('production.stop_categories').insert([
    { name: 'Lipsa material' },
    { name: 'Defect utilaj' },
    { name: 'Defect sculă' },
    { name: 'Schimb serie' },
    { name: 'Pauza masa' },
    { name: 'Curatenie' },
    { name: 'Control calitate' },
    { name: 'Lipsa operator' },
    { name: 'Altele' },
  ]);

  await knex('production.scrap_reasons').insert([
    { name: 'Dimensiuni incorecte' },
    { name: 'Suprafata deteriorata' },
    { name: 'Material defect' },
    { name: 'Eroare operator' },
    { name: 'Uzura scula' },
    { name: 'Parametri proces incorecti' },
    { name: 'Altele' },
  ]);

  // Indexes
  await knex.raw(`CREATE INDEX idx_reports_machine_id ON production.reports(machine_id)`);
  await knex.raw(`CREATE INDEX idx_reports_operator_id ON production.reports(operator_id)`);
  await knex.raw(`CREATE INDEX idx_reports_reported_at ON production.reports(reported_at)`);
  await knex.raw(`CREATE INDEX idx_stops_machine_id ON production.stops(machine_id)`);
  await knex.raw(`CREATE INDEX idx_stops_started_at ON production.stops(started_at)`);
  await knex.raw(`CREATE INDEX idx_orders_machine_id ON production.orders(machine_id)`);
  await knex.raw(`CREATE INDEX idx_orders_status ON production.orders(status)`);
}

export async function down(knex) {
  await knex.schema.withSchema('production').dropTableIfExists('scrap_reasons');
  await knex.schema.withSchema('production').dropTableIfExists('stop_categories');
  await knex.schema.withSchema('production').dropTableIfExists('shifts');
  await knex.schema.withSchema('production').dropTableIfExists('stops');
  await knex.schema.withSchema('production').dropTableIfExists('reports');
  await knex.schema.withSchema('production').dropTableIfExists('orders');
  await knex.raw('DROP SCHEMA IF EXISTS production');
}
