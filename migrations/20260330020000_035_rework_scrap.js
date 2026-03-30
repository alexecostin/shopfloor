export async function up(knex) {
  // Add rework fields to production.reports
  await knex.raw("ALTER TABLE production.reports ADD COLUMN IF NOT EXISTS scrap_reason_code VARCHAR(100)");
  await knex.raw("ALTER TABLE production.reports ADD COLUMN IF NOT EXISTS rework_pieces INTEGER DEFAULT 0");
  await knex.raw("ALTER TABLE production.reports ADD COLUMN IF NOT EXISTS rework_reason_code VARCHAR(100)");

  // Rework queue table
  await knex.schema.withSchema('production').createTable('rework_queue', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('source_report_id').nullable().references('id').inTable('production.reports');
    t.uuid('order_id').nullable();
    t.uuid('source_machine_id').nullable();
    t.uuid('target_machine_id').nullable();
    t.string('product_reference', 100).nullable();
    t.string('product_name', 255).nullable();
    t.integer('rework_qty').notNullable();
    t.string('rework_reason', 255).nullable();
    t.string('status', 30).defaultTo('pending').checkIn(['pending', 'planned', 'in_progress', 'completed', 'scrapped']);
    t.integer('rework_good').defaultTo(0);
    t.integer('rework_scrapped').defaultTo(0);
    t.uuid('assigned_to').nullable();
    t.text('notes').nullable();
    t.uuid('tenant_id').nullable();
    t.uuid('org_unit_id').nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('started_at', { useTz: true }).nullable();
    t.timestamp('completed_at', { useTz: true }).nullable();
  });

  await knex.raw('CREATE INDEX idx_rework_queue_status ON production.rework_queue(status)');
  await knex.raw('CREATE INDEX idx_rework_queue_order ON production.rework_queue(order_id)');

  // Add rework_reasons to lookup seeds
  const exists = await knex('system.lookup_definitions').where('lookup_type', 'rework_reasons').first().catch(() => null);
  if (!exists) {
    await knex('system.lookup_definitions').insert({
      lookup_type: 'rework_reasons', display_name: 'Motive reprelucrare',
      is_system: false, allow_tenant_customization: true,
    }).catch(() => {});

    const reasons = [
      { code: 'cota_in_afara', display_name: 'Cota in afara tolerantei', sort_order: 1 },
      { code: 'rugozitate', display_name: 'Rugozitate neconforma', sort_order: 2 },
      { code: 'bavura', display_name: 'Bavura excesiva', sort_order: 3 },
      { code: 'defect_suprafata', display_name: 'Defect suprafata', sort_order: 4 },
      { code: 'eroare_operare', display_name: 'Eroare de operare', sort_order: 5 },
      { code: 'altul', display_name: 'Altul', sort_order: 99 },
    ];
    for (const r of reasons) {
      await knex('system.lookup_values').insert({
        tenant_id: null, lookup_type: 'rework_reasons', ...r, is_active: true,
      }).catch(() => {});
    }
  }
}

export async function down(knex) {
  await knex.schema.withSchema('production').dropTableIfExists('rework_queue');
  await knex.raw("ALTER TABLE production.reports DROP COLUMN IF EXISTS scrap_reason_code");
  await knex.raw("ALTER TABLE production.reports DROP COLUMN IF EXISTS rework_pieces");
  await knex.raw("ALTER TABLE production.reports DROP COLUMN IF EXISTS rework_reason_code");
}
