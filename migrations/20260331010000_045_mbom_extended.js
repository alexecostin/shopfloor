export async function up(knex) {
  // Add MBOM fields to bom.operations
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS cnc_program VARCHAR(255)");
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS raw_material_spec TEXT");
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS tools_config JSONB DEFAULT '[]'");
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS machine_parameters JSONB DEFAULT '[]'");
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS consumables JSONB DEFAULT '[]'");
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS attention_points JSONB DEFAULT '[]'");
  await knex.raw("ALTER TABLE bom.operations ADD COLUMN IF NOT EXISTS min_batch_before_next INTEGER");
}

export async function down(knex) {
  const cols = ['cnc_program', 'raw_material_spec', 'tools_config', 'machine_parameters', 'consumables', 'attention_points', 'min_batch_before_next'];
  for (const c of cols) await knex.raw(`ALTER TABLE bom.operations DROP COLUMN IF EXISTS ${c}`);
}
