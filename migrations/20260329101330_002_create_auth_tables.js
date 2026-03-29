export async function up(knex) {
  await knex.raw('CREATE SCHEMA IF NOT EXISTS auth');

  await knex.schema.withSchema('auth').createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('email', 255).unique().notNullable();
    t.string('password_hash', 255).notNullable();
    t.string('full_name', 255).notNullable();
    t.string('role', 50).notNullable();
    t.string('badge_number', 50).nullable();
    t.string('phone', 50).nullable();
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE auth.users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'production_manager', 'shift_leader', 'operator', 'maintenance'))
  `);

  await knex.raw(`CREATE INDEX idx_auth_users_email ON auth.users(email)`);
  await knex.raw(`CREATE INDEX idx_auth_users_role ON auth.users(role)`);
}

export async function down(knex) {
  await knex.schema.withSchema('auth').dropTableIfExists('users');
  await knex.raw('DROP SCHEMA IF EXISTS auth');
}
