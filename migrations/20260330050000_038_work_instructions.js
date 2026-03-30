export async function up(knex) {
  await knex.schema.withSchema('production').createTable('work_instructions', t => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('product_id').nullable(); // → bom.products
    t.uuid('operation_id').nullable(); // → bom.operations
    t.string('machine_type', 50).nullable(); // applies to all machines of this type
    t.uuid('machine_id').nullable(); // specific machine
    t.string('title', 255).notNullable();
    t.text('drawing_url').nullable(); // URL to technical drawing image/PDF
    t.jsonb('parameters').defaultTo('[]'); // [{name, value, unit}]
    t.jsonb('attention_points').defaultTo('[]'); // [{text, severity: 'info'|'warning'|'critical'}]
    t.jsonb('tolerances').defaultTo('[]'); // [{characteristic, nominal, upper, lower, unit}]
    t.text('video_url').nullable();
    t.text('notes').nullable();
    t.integer('revision').defaultTo(1);
    t.boolean('is_active').defaultTo(true);
    t.uuid('tenant_id').nullable();
    t.uuid('created_by').nullable();
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX idx_work_instructions_product ON production.work_instructions(product_id)');
  await knex.raw('CREATE INDEX idx_work_instructions_operation ON production.work_instructions(operation_id)');
  await knex.raw('CREATE INDEX idx_work_instructions_machine_type ON production.work_instructions(machine_type)');
}

export async function down(knex) {
  await knex.schema.withSchema('production').dropTableIfExists('work_instructions');
}
