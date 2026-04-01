export async function up(knex) {
  // Add commercial fields to work orders
  await knex.raw("ALTER TABLE production.work_orders ADD COLUMN IF NOT EXISTS client_id UUID");
  await knex.raw("ALTER TABLE production.work_orders ADD COLUMN IF NOT EXISTS client_contact_id UUID");
  await knex.raw("ALTER TABLE production.work_orders ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2)");
  await knex.raw("ALTER TABLE production.work_orders ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'RON'");
  await knex.raw("ALTER TABLE production.work_orders ADD COLUMN IF NOT EXISTS total_value NUMERIC(12,2)");
  await knex.raw("ALTER TABLE production.work_orders ADD COLUMN IF NOT EXISTS incoterms VARCHAR(20)");
  await knex.raw("ALTER TABLE production.work_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT");
  await knex.raw("ALTER TABLE production.work_orders ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100)");
  await knex.raw("ALTER TABLE production.work_orders ADD COLUMN IF NOT EXISTS material_status VARCHAR(30) DEFAULT 'not_checked'");
  await knex.raw("ALTER TABLE production.work_orders ADD COLUMN IF NOT EXISTS technical_check_status VARCHAR(30) DEFAULT 'not_checked'");
  await knex.raw("ALTER TABLE production.work_orders ADD COLUMN IF NOT EXISTS launched_at TIMESTAMP WITH TIME ZONE");
  await knex.raw("ALTER TABLE production.work_orders ADD COLUMN IF NOT EXISTS launched_by UUID");

  // Operation templates for reuse
  await knex.schema.withSchema('bom').createTable('operation_templates', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('operation_type', 100).notNullable();
    t.string('machine_type', 100);
    t.integer('default_cycle_time_seconds');
    t.string('default_time_unit', 10).defaultTo('seconds');
    t.integer('default_setup_time_minutes');
    t.jsonb('default_tools_config').defaultTo('[]');
    t.jsonb('default_machine_parameters').defaultTo('[]');
    t.jsonb('default_consumables').defaultTo('[]');
    t.jsonb('default_attention_points').defaultTo('[]');
    t.string('default_reject_action', 30).defaultTo('scrap');
    t.uuid('tenant_id');
    t.boolean('is_active').defaultTo(true);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Technical check checklist per order
  await knex.schema.withSchema('production').createTable('technical_checks', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('work_order_id').notNullable();
    t.string('check_item', 255).notNullable();
    t.boolean('is_passed').defaultTo(false);
    t.text('notes');
    t.uuid('checked_by');
    t.timestamp('checked_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.withSchema('production').dropTableIfExists('technical_checks');
  await knex.schema.withSchema('bom').dropTableIfExists('operation_templates');
  const cols = ['client_id','client_contact_id','unit_price','currency','total_value','incoterms','delivery_address','payment_terms','material_status','technical_check_status','launched_at','launched_by'];
  for (const c of cols) await knex.raw(`ALTER TABLE production.work_orders DROP COLUMN IF EXISTS ${c}`);
}
