export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS machines');

  await knex.schema.withSchema('machines').createTable('machines', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('code', 50).unique().notNullable();
    t.string('name', 255).notNullable();
    t.string('type', 100).notNullable();
    t.string('location', 255).nullable();
    t.string('status', 50).defaultTo('active');
    t.jsonb('metadata').defaultTo('{}');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE machines.machines
    ADD CONSTRAINT machines_status_check
    CHECK (status IN ('active', 'maintenance', 'inactive'))
  `);

  await knex.schema.withSchema('machines').createTable('machine_operators', (t) => {
    t.uuid('machine_id').references('id').inTable('machines.machines').onDelete('CASCADE');
    t.uuid('user_id').notNullable();
    t.timestamp('assigned_at').defaultTo(knex.fn.now());
    t.primary(['machine_id', 'user_id']);
  });

  await knex.raw(`CREATE INDEX idx_machines_status ON machines.machines(status)`);
  await knex.raw(`CREATE INDEX idx_machines_type ON machines.machines(type)`);
}

export async function down(knex) {
  await knex.schema.withSchema('machines').dropTableIfExists('machine_operators');
  await knex.schema.withSchema('machines').dropTableIfExists('machines');
  await knex.raw('DROP SCHEMA IF EXISTS machines');
}
