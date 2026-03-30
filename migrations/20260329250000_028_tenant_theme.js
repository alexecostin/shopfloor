export async function up(knex) {
  const hasTable = await knex.schema.withSchema('system').hasTable('tenant_theme');
  if (!hasTable) {
    await knex.schema.withSchema('system').createTable('tenant_theme', t => {
      t.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
      t.uuid('tenant_id').references('id').inTable('system.tenants').unique();
      t.string('logo_url', 500);
      t.string('logo_dark_url', 500);
      t.string('favicon_url', 500);
      t.string('primary_color', 7).defaultTo('#3B82F6');
      t.string('secondary_color', 7).defaultTo('#64748B');
      t.string('accent_color', 7).defaultTo('#3B82F6');
      t.string('danger_color', 7).defaultTo('#FF4757');
      t.string('warning_color', 7).defaultTo('#FFB020');
      t.string('success_color', 7).defaultTo('#00D4AA');
      t.string('sidebar_bg', 7).defaultTo('#0F172A');
      t.string('header_bg', 7).defaultTo('#1E293B');
      t.string('font_family', 100).defaultTo('DM Sans');
      t.boolean('dark_mode_enabled').defaultTo(true);
      t.string('company_name_display', 255);
      t.string('login_background_url', 500);
      t.text('custom_css');
      t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex) {
  await knex.schema.withSchema('system').dropTableIfExists('tenant_theme');
}
