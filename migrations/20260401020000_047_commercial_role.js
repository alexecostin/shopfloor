export async function up(knex) {
  // Add 'commercial' to the auth.users role CHECK constraint
  // First drop old constraint, then add new one with commercial included
  await knex.raw(`ALTER TABLE auth.users DROP CONSTRAINT IF EXISTS users_role_check`);
  await knex.raw(`
    ALTER TABLE auth.users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'production_manager', 'shift_leader', 'operator', 'maintenance', 'commercial'))
  `);
}

export async function down(knex) {
  await knex.raw(`ALTER TABLE auth.users DROP CONSTRAINT IF EXISTS users_role_check`);
  await knex.raw(`
    ALTER TABLE auth.users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'production_manager', 'shift_leader', 'operator', 'maintenance'))
  `);
}
