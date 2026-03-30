export async function up(knex) {
  await knex.schema.withSchema('auth').createTable('skill_level_definitions', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 100).notNullable();
    t.integer('rank').notNullable(); // 1=highest
    t.boolean('can_work_unsupervised').defaultTo(false);
    t.string('color', 20).defaultTo('#gray'); // for UI
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('auth').createTable('operator_skills', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable(); // → auth.users
    t.uuid('machine_id').notNullable().references('id').inTable('machines.machines').onDelete('CASCADE');
    t.uuid('skill_level_id').notNullable().references('id').inTable('auth.skill_level_definitions').onDelete('RESTRICT');
    t.integer('max_simultaneous_machines').defaultTo(1);
    t.date('certified_at').nullable();
    t.date('expires_at').nullable();
    t.uuid('certified_by').nullable();
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['user_id', 'machine_id']);
  });

  await knex.schema.withSchema('auth').createTable('operator_shift_patterns', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable();
    t.string('shift', 20).notNullable(); // 'Tura I', 'Tura II', 'Tura III'
    t.specificType('work_days', 'integer[]').defaultTo('{1,2,3,4,5}'); // 1=Mon..7=Sun
    t.date('valid_from').notNullable();
    t.date('valid_to').nullable();
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('auth').createTable('operator_shift_overrides', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable();
    t.date('date').notNullable();
    t.string('shift', 20).nullable(); // NULL = not working that day
    t.text('reason');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['user_id', 'date']);
  });

  await knex.schema.withSchema('auth').createTable('leave_requests', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable();
    t.string('leave_type', 50).defaultTo('annual').checkIn(['annual', 'medical', 'unpaid', 'other']);
    t.date('start_date').notNullable();
    t.date('end_date').notNullable();
    t.text('reason');
    t.string('status', 20).defaultTo('pending').checkIn(['pending', 'approved', 'rejected']);
    t.uuid('reviewed_by').nullable();
    t.timestamp('reviewed_at', { useTz: true }).nullable();
    t.text('reviewer_notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.withSchema('auth').dropTableIfExists('leave_requests');
  await knex.schema.withSchema('auth').dropTableIfExists('operator_shift_overrides');
  await knex.schema.withSchema('auth').dropTableIfExists('operator_shift_patterns');
  await knex.schema.withSchema('auth').dropTableIfExists('operator_skills');
  await knex.schema.withSchema('auth').dropTableIfExists('skill_level_definitions');
}
