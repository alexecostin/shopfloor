export async function seed(knex) {
  await knex('auth.skill_level_definitions').del();
  await knex('auth.skill_level_definitions').insert([
    { name: 'Expert', rank: 1, can_work_unsupervised: true, color: '#16a34a' },
    { name: 'Certificat', rank: 2, can_work_unsupervised: true, color: '#2563eb' },
    { name: 'Asistat', rank: 3, can_work_unsupervised: false, color: '#d97706' },
    { name: 'In training', rank: 4, can_work_unsupervised: false, color: '#9333ea' },
    { name: 'Neautorizat', rank: 5, can_work_unsupervised: false, color: '#dc2626' },
  ]);
}
