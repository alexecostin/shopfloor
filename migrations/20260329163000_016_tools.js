export async function up(knex) {
  await knex.schema.withSchema('machines').createTable('tools', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('code', 100).notNullable().unique();
    t.string('name', 255).notNullable();
    t.string('type', 100); // 'matrita', 'freza', 'burghiu', etc.
    t.string('tracking_mode', 20).notNullable().defaultTo('tracked').checkIn(['tracked', 'consumable']);
    t.string('status', 20).defaultTo('active').checkIn(['active', 'maintenance', 'retired']);
    t.uuid('current_machine_id').nullable().references('id').inTable('machines.machines').onDelete('SET NULL');
    t.integer('maintenance_interval_cycles').nullable();
    t.decimal('maintenance_interval_hours', 10, 2).nullable();
    t.integer('current_cycles').defaultTo(0);
    t.decimal('current_hours', 10, 2).defaultTo(0);
    t.date('next_maintenance_due').nullable();
    // Consumable fields
    t.uuid('inventory_item_id').nullable(); // → inventory.items
    t.decimal('consumption_per_hour', 10, 4).nullable();
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.withSchema('machines').createTable('tool_maintenance_log', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tool_id').notNullable().references('id').inTable('machines.tools').onDelete('CASCADE');
    t.string('maintenance_type', 50).notNullable().checkIn(['preventive', 'corrective', 'inspection']);
    t.text('description');
    t.decimal('cost', 10, 2).nullable();
    t.uuid('performed_by').nullable();
    t.timestamp('performed_at', { useTz: true }).defaultTo(knex.fn.now());
    t.integer('cycles_at_maintenance').nullable();
    t.decimal('hours_at_maintenance', 10, 2).nullable();
    t.date('next_maintenance_due').nullable();
    t.text('notes');
  });

  await knex.schema.withSchema('machines').createTable('tool_assignments_log', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tool_id').notNullable().references('id').inTable('machines.tools').onDelete('CASCADE');
    t.uuid('from_machine_id').nullable().references('id').inTable('machines.machines').onDelete('SET NULL');
    t.uuid('to_machine_id').nullable().references('id').inTable('machines.machines').onDelete('SET NULL');
    t.uuid('assigned_by').nullable();
    t.timestamp('assigned_at', { useTz: true }).defaultTo(knex.fn.now());
    t.text('notes');
  });
}

export async function down(knex) {
  await knex.schema.withSchema('machines').dropTableIfExists('tool_assignments_log');
  await knex.schema.withSchema('machines').dropTableIfExists('tool_maintenance_log');
  await knex.schema.withSchema('machines').dropTableIfExists('tools');
}
