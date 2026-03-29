export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS maintenance');

  await knex.schema.withSchema('maintenance').createTable('requests', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('request_number', 50).unique().notNullable();
    t.uuid('machine_id').notNullable();
    t.uuid('reported_by').notNullable();
    t.uuid('assigned_to').nullable();
    t.string('problem_type', 100).notNullable();
    t.text('description').nullable();
    t.string('priority', 20).defaultTo('normal');
    t.string('status', 50).defaultTo('open');
    t.string('photo_url', 500).nullable();
    t.text('resolution').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('started_at').nullable();
    t.timestamp('resolved_at').nullable();
  });

  await knex.raw(`
    ALTER TABLE maintenance.requests
    ADD CONSTRAINT requests_priority_check
    CHECK (priority IN ('low', 'normal', 'high', 'critical'))
  `);

  await knex.raw(`
    ALTER TABLE maintenance.requests
    ADD CONSTRAINT requests_status_check
    CHECK (status IN ('open', 'in_progress', 'done', 'cancelled'))
  `);

  // Auto-increment sequence for request_number MT-0001
  await knex.raw(`CREATE SEQUENCE IF NOT EXISTS maintenance.request_number_seq START 1`);

  await knex.raw(`CREATE INDEX idx_requests_machine_id ON maintenance.requests(machine_id)`);
  await knex.raw(`CREATE INDEX idx_requests_status ON maintenance.requests(status)`);
  await knex.raw(`CREATE INDEX idx_requests_reported_by ON maintenance.requests(reported_by)`);
}

export async function down(knex) {
  await knex.schema.withSchema('maintenance').dropTableIfExists('requests');
  await knex.raw('DROP SEQUENCE IF EXISTS maintenance.request_number_seq');
  await knex.raw('DROP SCHEMA IF EXISTS maintenance');
}
