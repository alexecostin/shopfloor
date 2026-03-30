export async function up(knex) {
  // ─── Machine Groups ─────────────────────────────────────────────────────────
  await knex.schema.withSchema('machines').createTable('machine_groups', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('description', 500);
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // M:N: masini pot face parte din mai multe grupe
  await knex.schema.withSchema('machines').createTable('group_machines', (t) => {
    t.uuid('group_id').notNullable().references('id').inTable('machines.machine_groups').onDelete('CASCADE');
    t.uuid('machine_id').notNullable().references('id').inTable('machines.machines').onDelete('CASCADE');
    t.timestamp('added_at', { useTz: true }).defaultTo(knex.fn.now());
    t.primary(['group_id', 'machine_id']);
  });

  // Capabilitatile unui utilaj: ce tipuri de operatii poate executa + costul orar
  await knex.schema.withSchema('machines').createTable('machine_capabilities', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('machine_id').notNullable().references('id').inTable('machines.machines').onDelete('CASCADE');
    t.string('operation_type', 100).notNullable(); // ex: "Strunjire", "Frezare", "Inspectie"
    t.string('operation_name', 255);               // optional: denumire specifica
    t.decimal('cycle_time_seconds', 10, 2);        // timp ciclu implicit pe aceasta masina
    t.decimal('hourly_rate_eur', 10, 2);           // cost orar EUR
    t.decimal('setup_time_minutes', 10, 2).defaultTo(0);
    t.integer('nr_cavities').defaultTo(1);
    t.boolean('is_preferred').defaultTo(false);    // masina preferata pentru acest tip operatie
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Alternative masini per operatie BOM
  await knex.schema.withSchema('bom').createTable('operation_alternatives', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('operation_id').notNullable().references('id').inTable('bom.operations').onDelete('CASCADE');
    t.uuid('machine_id').notNullable().references('id').inTable('machines.machines').onDelete('CASCADE');
    t.boolean('is_preferred').defaultTo(false);
    t.decimal('cycle_time_seconds_override', 10, 2); // override fata de operatia BOM
    t.decimal('setup_time_minutes_override', 10, 2);
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['operation_id', 'machine_id']);
  });
}

export async function down(knex) {
  await knex.schema.withSchema('bom').dropTableIfExists('operation_alternatives');
  await knex.schema.withSchema('machines').dropTableIfExists('machine_capabilities');
  await knex.schema.withSchema('machines').dropTableIfExists('group_machines');
  await knex.schema.withSchema('machines').dropTableIfExists('machine_groups');
}
