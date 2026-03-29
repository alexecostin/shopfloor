import bcrypt from 'bcrypt';

export async function seed(knex) {
  await knex('auth.users').where({ email: 'admin@shopfloor.local' }).del();

  const password_hash = await bcrypt.hash('ShopFloor2026!', 10);

  await knex('auth.users').insert({
    email: 'admin@shopfloor.local',
    password_hash,
    full_name: 'Administrator',
    role: 'admin',
    is_active: true,
  });
}
