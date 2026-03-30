export async function up(knex) {
  // ─── Work Orders ─────────────────────────────────────────────────────────────
  // O comanda de productie poate genera mai multe comenzi de lucru (una per reper/operatie batch)
  await knex.schema.withSchema('production').createTable('work_orders', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('work_order_number', 50).unique().notNullable(); // ex: CL-00001
    t.uuid('order_id').references('id').inTable('production.orders').onDelete('SET NULL');
    t.string('order_number', 100);          // denormalizat pentru afisare
    t.uuid('product_id');                   // referinta BOM product
    t.string('product_reference', 100);
    t.string('product_name', 255);
    t.integer('quantity').notNullable().defaultTo(1);
    t.string('priority', 20).defaultTo('normal').checkIn(['low', 'normal', 'high', 'urgent']);
    t.string('status', 50).defaultTo('planned')
      .checkIn(['planned', 'released', 'in_progress', 'completed', 'cancelled']);
    t.date('scheduled_start');
    t.date('scheduled_end');
    t.timestamp('actual_start', { useTz: true });
    t.timestamp('actual_end', { useTz: true });
    t.uuid('created_by');
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE SEQUENCE IF NOT EXISTS production.work_order_seq START 1');

  // ─── Work Order Operations (linii operatie) ───────────────────────────────────
  // Fiecare linie = o operatie secventiata din BOM, alocata pe masina + operator
  await knex.schema.withSchema('production').createTable('work_order_operations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('work_order_id').notNullable().references('id').inTable('production.work_orders').onDelete('CASCADE');
    t.integer('sequence').notNullable();
    t.uuid('bom_operation_id').references('id').inTable('bom.operations'); // sursa BOM
    t.string('operation_name', 255).notNullable();
    t.string('operation_type', 100);
    // Masina alocata (poate fi alternativa)
    t.uuid('machine_id').references('id').inTable('machines.machines');
    t.string('machine_code', 50);           // denormalizat
    t.string('machine_name', 255);          // denormalizat
    // Operator alocat
    t.uuid('operator_id').references('id').inTable('auth.users');
    t.string('operator_name', 255);         // denormalizat
    // Timpi
    t.decimal('cycle_time_seconds', 10, 2);
    t.integer('nr_cavities').defaultTo(1);
    t.decimal('pieces_per_hour', 10, 2);
    t.decimal('setup_time_minutes', 10, 2).defaultTo(0);
    t.decimal('planned_hours', 8, 2);       // calculat: (qty / pieces_per_hour) + setup
    t.decimal('actual_hours', 8, 2);        // completat dupa executie
    // Costuri
    t.decimal('hourly_rate_eur', 10, 2);    // snapshot la momentul planificarii
    t.decimal('planned_cost_eur', 10, 2);   // planned_hours * hourly_rate
    t.decimal('actual_cost_eur', 10, 2);    // actual_hours * hourly_rate
    // Status
    t.string('status', 50).defaultTo('planned')
      .checkIn(['planned', 'in_progress', 'completed', 'skipped']);
    t.timestamp('started_at', { useTz: true });
    t.timestamp('completed_at', { useTz: true });
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['work_order_id', 'sequence']);
  });

  // ─── HR Allocations ──────────────────────────────────────────────────────────
  // Alocare resurse umane pe comenzi/operatii (ore + cost)
  await knex.schema.withSchema('production').createTable('hr_allocations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('work_order_id').references('id').inTable('production.work_orders').onDelete('CASCADE');
    t.uuid('work_order_operation_id').references('id').inTable('production.work_order_operations').onDelete('SET NULL');
    t.uuid('user_id').notNullable().references('id').inTable('auth.users');
    t.string('user_name', 255);             // denormalizat
    t.string('role_at_time', 50);           // rol la momentul alocarii
    t.decimal('hourly_rate_eur', 10, 2);    // snapshot cost orar
    t.decimal('allocated_hours', 8, 2).notNullable();
    t.decimal('actual_hours', 8, 2);
    t.decimal('planned_cost_eur', 10, 2);
    t.decimal('actual_cost_eur', 10, 2);
    t.date('allocation_date');
    t.string('shift', 20);
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // ─── HR Cost Rates per user ───────────────────────────────────────────────────
  // Cost orar per angajat sau per rol
  await knex.schema.withSchema('auth').createTable('user_cost_rates', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').references('id').inTable('auth.users').onDelete('CASCADE');
    t.string('role', 50);                   // alternativ: cost per rol (fara user specific)
    t.decimal('hourly_rate_eur', 10, 2).notNullable();
    t.decimal('overhead_factor', 5, 3).defaultTo(1.0); // multiplicator pt costuri admin
    t.date('valid_from').defaultTo(knex.fn.now());
    t.date('valid_to');
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.withSchema('auth').dropTableIfExists('user_cost_rates');
  await knex.schema.withSchema('production').dropTableIfExists('hr_allocations');
  await knex.schema.withSchema('production').dropTableIfExists('work_order_operations');
  await knex.schema.withSchema('production').dropTableIfExists('work_orders');
  await knex.raw('DROP SEQUENCE IF EXISTS production.work_order_seq');
}
