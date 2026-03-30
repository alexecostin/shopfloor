export async function up(knex) {
  await knex.schema.withSchema('system').createTable('email_templates', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').nullable(); // null = global default
    t.string('template_type', 50).notNullable();
    t.string('lang', 10).notNullable().defaultTo('ro');
    t.string('subject', 255).notNullable();
    t.text('body_html').notNullable();
    t.jsonb('variables').defaultTo('[]'); // array of variable names, e.g. ["machineCode", "priority"]
    t.boolean('is_active').defaultTo(true);
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['tenant_id', 'template_type', 'lang']);
  });
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_email_tmpl_type_lang ON system.email_templates(template_type, lang)`);
}

export async function down(knex) {
  await knex.schema.withSchema('system').dropTableIfExists('email_templates');
}
